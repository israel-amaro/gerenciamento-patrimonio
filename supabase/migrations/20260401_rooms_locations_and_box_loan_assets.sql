alter table public.rooms
  add column if not exists floor text,
  add column if not exists description text,
  add column if not exists room_type text not null default 'classroom',
  add column if not exists is_active boolean not null default true;

alter table public.loans
  add column if not exists location_type text,
  add column if not exists location_lab_id uuid references public.labs(id);

alter table public.loans drop constraint if exists loans_location_check;
alter table public.loans add constraint loans_location_check check (
  (
    location_type is null
    and room_id is null
    and location_lab_id is null
  )
  or (
    location_type = 'room'
    and room_id is not null
    and location_lab_id is null
  )
  or (
    location_type = 'lab'
    and room_id is null
    and location_lab_id is not null
  )
);

create table if not exists public.box_loan_assets (
  loan_id uuid not null references public.loans(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (loan_id, asset_id)
);

alter table public.box_loan_assets enable row level security;

drop policy if exists "box_loan_assets_read_public" on public.box_loan_assets;
create policy "box_loan_assets_read_public"
on public.box_loan_assets for select to authenticated, anon
using (true);

grant select on table public.box_loan_assets to authenticated, anon;

create or replace function public.request_loan(
  p_box_id uuid,
  p_responsible_name text,
  p_room_id uuid,
  p_room_name text,
  p_session_class text,
  p_expected_return_at timestamptz,
  p_notes text default null,
  p_location_lab_id uuid default null,
  p_selected_asset_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loan_id uuid;
  v_box_status text;
  v_location_name text;
  v_invalid_asset_id uuid;
begin
  select status
  into v_box_status
  from public.boxes
  where id = p_box_id;

  if v_box_status is null then
    raise exception 'Caixa nao encontrada.';
  end if;

  if v_box_status <> 'available' then
    raise exception 'A caixa selecionada nao esta disponivel.';
  end if;

  if coalesce(btrim(p_responsible_name), '') = '' then
    raise exception 'Informe o responsavel.';
  end if;

  if coalesce(btrim(p_session_class), '') = '' then
    raise exception 'Informe a turma ou disciplina.';
  end if;

  if p_room_id is not null and p_location_lab_id is not null then
    raise exception 'Selecione apenas um local para o emprestimo.';
  end if;

  if p_room_id is not null then
    select name
    into v_location_name
    from public.rooms
    where id = p_room_id
      and is_active = true;

    if v_location_name is null then
      raise exception 'Sala cadastrada nao encontrada ou inativa.';
    end if;
  elsif p_location_lab_id is not null then
    select name
    into v_location_name
    from public.labs
    where id = p_location_lab_id;

    if v_location_name is null then
      raise exception 'Laboratorio selecionado nao encontrado.';
    end if;
  end if;

  insert into public.loans (
    box_id,
    responsible_name,
    room_id,
    location_lab_id,
    location_type,
    room_name,
    session_class,
    expected_return_at,
    notes,
    status,
    created_by
  )
  values (
    p_box_id,
    btrim(p_responsible_name),
    p_room_id,
    p_location_lab_id,
    case
      when p_room_id is not null then 'room'
      when p_location_lab_id is not null then 'lab'
      else null
    end,
    coalesce(nullif(btrim(coalesce(p_room_name, '')), ''), v_location_name),
    btrim(p_session_class),
    p_expected_return_at,
    nullif(btrim(coalesce(p_notes, '')), ''),
    'active',
    auth.uid()
  )
  returning id into v_loan_id;

  if coalesce(array_length(p_selected_asset_ids, 1), 0) > 0 then
    select invalid_assets.asset_id
    into v_invalid_asset_id
    from (
      select distinct unnest(p_selected_asset_ids) as asset_id
    ) invalid_assets
    where not exists (
      select 1
      from public.box_assets ba
      where ba.box_id = p_box_id
        and ba.asset_id = invalid_assets.asset_id
    )
    limit 1;

    if v_invalid_asset_id is not null then
      raise exception 'Um ou mais ativos selecionados nao pertencem ao carrinho informado.';
    end if;

    insert into public.box_loan_assets (loan_id, asset_id)
    select v_loan_id, selected_assets.asset_id
    from (
      select distinct unnest(p_selected_asset_ids) as asset_id
    ) selected_assets;
  end if;

  update public.boxes
  set status = 'borrowed'
  where id = p_box_id;

  return v_loan_id;
end;
$$;

create or replace function public.request_loan_by_asset(
  p_asset_id uuid,
  p_responsible_name text,
  p_room_id uuid,
  p_room_name text,
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
    select 1
    from public.assets
    where id = p_asset_id
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
    room_name,
    location_type,
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
    nullif(btrim(coalesce(p_room_name, '')), ''),
    case when p_room_id is not null then 'room' else null end,
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
  p_room_name text,
  p_session_class text,
  p_expected_return_at timestamptz,
  p_notes text default null,
  p_location_lab_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loan_id uuid;
  v_location_name text;
begin
  if not exists (
    select 1
    from public.labs
    where id = p_lab_id
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

  if p_room_id is not null and p_location_lab_id is not null then
    raise exception 'Selecione apenas um local para o emprestimo.';
  end if;

  if p_room_id is not null then
    select name
    into v_location_name
    from public.rooms
    where id = p_room_id
      and is_active = true;

    if v_location_name is null then
      raise exception 'Sala cadastrada nao encontrada ou inativa.';
    end if;
  elsif p_location_lab_id is not null then
    select name
    into v_location_name
    from public.labs
    where id = p_location_lab_id;

    if v_location_name is null then
      raise exception 'Laboratorio selecionado nao encontrado.';
    end if;
  end if;

  insert into public.loans (
    lab_id,
    responsible_name,
    room_id,
    location_lab_id,
    location_type,
    room_name,
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
    p_location_lab_id,
    case
      when p_room_id is not null then 'room'
      when p_location_lab_id is not null then 'lab'
      else null
    end,
    coalesce(nullif(btrim(coalesce(p_room_name, '')), ''), v_location_name),
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

create or replace function public.get_public_box_assets(p_box_id uuid)
returns table (
  asset_id uuid,
  tag_code text,
  model text,
  serial_number text,
  host_name text,
  domain_name text
)
language sql
security definer
set search_path = public
as $$
  select
    a.id as asset_id,
    a.tag_code,
    a.model,
    a.serial_number,
    a.host_name,
    a.domain_name
  from public.box_assets ba
  inner join public.assets a on a.id = ba.asset_id
  where ba.box_id = p_box_id
  order by a.tag_code nulls last, a.model
$$;

grant execute on function public.request_loan(uuid, text, uuid, text, text, timestamptz, text, uuid, uuid[]) to authenticated;
grant execute on function public.request_loan(uuid, text, uuid, text, text, timestamptz, text, uuid, uuid[]) to anon;
grant execute on function public.request_loan_by_lab(uuid, text, uuid, text, text, timestamptz, text, uuid) to authenticated;
grant execute on function public.request_loan_by_lab(uuid, text, uuid, text, text, timestamptz, text, uuid) to anon;
grant execute on function public.get_public_box_assets(uuid) to authenticated;
grant execute on function public.get_public_box_assets(uuid) to anon;
