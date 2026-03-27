-- Limpeza completa para entrada em producao com dados reais.
-- Rode este arquivo apenas quando quiser apagar os dados atuais do ambiente.

begin;

truncate table
  public.box_checklists,
  public.audits,
  public.incidents,
  public.professor_lab_checklists,
  public.loans,
  public.box_assets,
  public.assets,
  public.boxes,
  public.rooms,
  public.labs,
  public.asset_types,
  public.profiles
restart identity cascade;

commit;

-- Se tambem quiser remover os usuarios do Supabase Auth, execute separadamente:
-- delete from auth.users;
