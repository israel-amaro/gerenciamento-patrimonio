alter table public.assets add column if not exists host_name text;
alter table public.assets add column if not exists domain_name text;

alter table public.labs add column if not exists qr_code_value text unique;

alter table public.boxes add column if not exists qr_code_value text unique;
alter table public.boxes add column if not exists lab_id uuid references public.labs(id);
alter table public.boxes add column if not exists expected_asset_count integer;

alter table public.loans alter column box_id drop not null;
alter table public.loans add column if not exists asset_id uuid references public.assets(id);
alter table public.loans add column if not exists lab_id uuid references public.labs(id);

alter table public.loans drop constraint if exists loans_target_check;
alter table public.loans add constraint loans_target_check check (
  ((box_id is not null)::integer + (asset_id is not null)::integer + (lab_id is not null)::integer) = 1
);

create table if not exists public.box_checklists (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.boxes(id) on delete cascade,
  loan_id uuid references public.loans(id) on delete set null,
  responsible_name text not null,
  session_class text not null,
  stage text not null check (stage in ('pickup', 'return')),
  status text not null check (status in ('ok', 'has_issues')),
  notes text,
  reported_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.box_checklists enable row level security;

drop policy if exists "box_checklists_read_public" on public.box_checklists;
create policy "box_checklists_read_public"
on public.box_checklists for select to authenticated, anon
using (true);

drop policy if exists "box_checklists_write_public" on public.box_checklists;
create policy "box_checklists_write_public"
on public.box_checklists for insert to authenticated, anon
with check (true);

create or replace function public.return_loan(p_loan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_box_id uuid;
begin
  select box_id
  into v_box_id
  from public.loans
  where id = p_loan_id
    and status <> 'returned';

  if v_box_id is null and not exists (
    select 1
    from public.loans
    where id = p_loan_id
      and status <> 'returned'
  ) then
    raise exception 'Emprestimo nao encontrado ou ja devolvido.';
  end if;

  update public.loans
  set
    status = 'returned',
    returned_at = now(),
    returned_by = auth.uid()
  where id = p_loan_id;

  if v_box_id is not null then
    update public.boxes
    set status = 'available'
    where id = v_box_id;
  end if;

  return p_loan_id;
end;
$$;

create or replace function public.get_public_asset_context(p_asset_id uuid)
returns table (
  asset_id uuid,
  tag_code text,
  qr_code_value text,
  serial_number text,
  host_name text,
  domain_name text,
  model text,
  asset_status text,
  lab_id uuid,
  lab_name text,
  lab_location text,
  box_id uuid,
  box_name text,
  box_status text,
  active_loan_id uuid,
  loan_status text,
  borrowed_at timestamptz,
  expected_return_at timestamptz,
  responsible_name text,
  session_class text
)
language sql
security definer
set search_path = public
as $$
  select
    a.id as asset_id,
    a.tag_code,
    a.qr_code_value,
    a.serial_number,
    a.host_name,
    a.domain_name,
    a.model,
    a.status as asset_status,
    l.id as lab_id,
    l.name as lab_name,
    l.location as lab_location,
    b.id as box_id,
    b.name as box_name,
    b.status as box_status,
    coalesce(al.id, bl.id) as active_loan_id,
    coalesce(al.status, bl.status) as loan_status,
    coalesce(al.borrowed_at, bl.borrowed_at) as borrowed_at,
    coalesce(al.expected_return_at, bl.expected_return_at) as expected_return_at,
    coalesce(al.responsible_name, bl.responsible_name) as responsible_name,
    coalesce(al.session_class, bl.session_class) as session_class
  from public.assets a
  left join public.labs l on l.id = a.lab_id
  left join public.box_assets ba on ba.asset_id = a.id
  left join public.boxes b on b.id = ba.box_id
  left join public.loans al on al.asset_id = a.id and al.status <> 'returned'
  left join public.loans bl on bl.box_id = b.id and bl.status <> 'returned'
  where a.id = p_asset_id
  limit 1
$$;

create or replace function public.request_loan_by_asset(
  p_asset_id uuid,
  p_responsible_name text,
  p_room_id uuid,
  p_session_class text,
  p_expected_return_at timestamptz,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loan_id uuid;
begin
  if not exists (
    select 1 from public.assets where id = p_asset_id
  ) then
    raise exception 'Ativo nao encontrado.';
  end if;

  if exists (
    select 1
    from public.loans
    where asset_id = p_asset_id
      and status <> 'returned'
  ) then
    raise exception 'Este ativo ja possui emprestimo em aberto.';
  end if;

  if coalesce(btrim(p_responsible_name), '') = '' then
    raise exception 'Informe o responsavel.';
  end if;

  if coalesce(btrim(p_session_class), '') = '' then
    raise exception 'Informe a turma ou disciplina.';
  end if;

  insert into public.loans (
    asset_id,
    responsible_name,
    room_id,
    session_class,
    expected_return_at,
    notes,
    status,
    created_by
  )
  values (
    p_asset_id,
    btrim(p_responsible_name),
    p_room_id,
    btrim(p_session_class),
    p_expected_return_at,
    nullif(btrim(coalesce(p_notes, '')), ''),
    'active',
    auth.uid()
  )
  returning id into v_loan_id;

  return v_loan_id;
end;
$$;

create or replace function public.request_loan_by_lab(
  p_lab_id uuid,
  p_responsible_name text,
  p_room_id uuid,
  p_session_class text,
  p_expected_return_at timestamptz,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loan_id uuid;
begin
  if not exists (
    select 1 from public.labs where id = p_lab_id
  ) then
    raise exception 'Laboratorio nao encontrado.';
  end if;

  if exists (
    select 1
    from public.loans
    where lab_id = p_lab_id
      and status <> 'returned'
  ) then
    raise exception 'Este laboratorio ja possui emprestimo em aberto.';
  end if;

  if coalesce(btrim(p_responsible_name), '') = '' then
    raise exception 'Informe o responsavel.';
  end if;

  if coalesce(btrim(p_session_class), '') = '' then
    raise exception 'Informe a turma ou disciplina.';
  end if;

  insert into public.loans (
    lab_id,
    responsible_name,
    room_id,
    session_class,
    expected_return_at,
    notes,
    status,
    created_by
  )
  values (
    p_lab_id,
    btrim(p_responsible_name),
    p_room_id,
    btrim(p_session_class),
    p_expected_return_at,
    nullif(btrim(coalesce(p_notes, '')), ''),
    'active',
    auth.uid()
  )
  returning id into v_loan_id;

  return v_loan_id;
end;
$$;

create or replace function public.get_public_box_context(p_box_id uuid)
returns table (
  box_id uuid,
  box_name text,
  box_description text,
  box_status text,
  qr_code_value text,
  lab_id uuid,
  lab_name text,
  lab_location text,
  expected_asset_count integer,
  current_asset_count bigint,
  is_complete boolean,
  active_loan_id uuid,
  loan_status text,
  borrowed_at timestamptz,
  expected_return_at timestamptz,
  responsible_name text,
  session_class text
)
language sql
security definer
set search_path = public
as $$
  select
    b.id as box_id,
    b.name as box_name,
    b.description as box_description,
    b.status as box_status,
    b.qr_code_value,
    l.id as lab_id,
    l.name as lab_name,
    l.location as lab_location,
    b.expected_asset_count,
    count(ba.asset_id) as current_asset_count,
    case
      when b.expected_asset_count is null then null
      else count(ba.asset_id) = b.expected_asset_count
    end as is_complete,
    ln.id as active_loan_id,
    ln.status as loan_status,
    ln.borrowed_at,
    ln.expected_return_at,
    ln.responsible_name,
    ln.session_class
  from public.boxes b
  left join public.labs l on l.id = b.lab_id
  left join public.box_assets ba on ba.box_id = b.id
  left join public.loans ln on ln.box_id = b.id and ln.status <> 'returned'
  where b.id = p_box_id
  group by b.id, l.id, ln.id
$$;

create or replace function public.submit_public_box_checklist(
  p_box_id uuid,
  p_loan_id uuid,
  p_responsible_name text,
  p_session_class text,
  p_stage text,
  p_status text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checklist_id uuid;
begin
  if not exists (
    select 1 from public.boxes where id = p_box_id
  ) then
    raise exception 'Carrinho nao encontrado.';
  end if;

  if coalesce(btrim(p_responsible_name), '') = '' then
    raise exception 'Informe o responsavel.';
  end if;

  if coalesce(btrim(p_session_class), '') = '' then
    raise exception 'Informe a turma ou disciplina.';
  end if;

  if p_stage not in ('pickup', 'return') then
    raise exception 'Etapa de checklist invalida.';
  end if;

  if p_status not in ('ok', 'has_issues') then
    raise exception 'Status de checklist invalido.';
  end if;

  insert into public.box_checklists (
    box_id,
    loan_id,
    responsible_name,
    session_class,
    stage,
    status,
    notes,
    created_by
  )
  values (
    p_box_id,
    p_loan_id,
    btrim(p_responsible_name),
    btrim(p_session_class),
    p_stage,
    p_status,
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_checklist_id;

  return v_checklist_id;
end;
$$;

create or replace function public.get_public_lab_context(p_lab_id uuid)
returns table (
  lab_id uuid,
  lab_name text,
  lab_location text,
  qr_code_value text,
  asset_count bigint,
  active_loan_id uuid,
  loan_status text,
  borrowed_at timestamptz,
  expected_return_at timestamptz,
  responsible_name text,
  session_class text
)
language sql
security definer
set search_path = public
as $$
  select
    l.id as lab_id,
    l.name as lab_name,
    l.location as lab_location,
    l.qr_code_value,
    count(a.id) as asset_count,
    ln.id as active_loan_id,
    ln.status as loan_status,
    ln.borrowed_at,
    ln.expected_return_at,
    ln.responsible_name,
    ln.session_class
  from public.labs l
  left join public.assets a on a.lab_id = l.id
  left join public.loans ln on ln.lab_id = l.id and ln.status <> 'returned'
  where l.id = p_lab_id
  group by l.id, ln.id
$$;

grant execute on function public.request_loan_by_asset(uuid, text, uuid, text, timestamptz, text) to authenticated;
grant execute on function public.request_loan_by_asset(uuid, text, uuid, text, timestamptz, text) to anon;
grant execute on function public.request_loan_by_lab(uuid, text, uuid, text, timestamptz, text) to authenticated;
grant execute on function public.request_loan_by_lab(uuid, text, uuid, text, timestamptz, text) to anon;
grant execute on function public.get_public_asset_context(uuid) to authenticated;
grant execute on function public.get_public_asset_context(uuid) to anon;
grant execute on function public.get_public_box_context(uuid) to authenticated;
grant execute on function public.get_public_box_context(uuid) to anon;
grant execute on function public.submit_public_box_checklist(uuid, uuid, text, text, text, text, text) to authenticated;
grant execute on function public.submit_public_box_checklist(uuid, uuid, text, text, text, text, text) to anon;
grant execute on function public.get_public_lab_context(uuid) to authenticated;
grant execute on function public.get_public_lab_context(uuid) to anon;
