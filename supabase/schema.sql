CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'professor' CHECK (role IN ('admin', 'technician', 'professor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.asset_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.labs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  building TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id UUID NOT NULL REFERENCES public.asset_types(id),
  tag_code TEXT NOT NULL UNIQUE,
  qr_code_value TEXT NOT NULL UNIQUE,
  serial_number TEXT,
  host_name TEXT,
  domain_name TEXT,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'defective', 'missing', 'retired')),
  lab_id UUID REFERENCES public.labs(id),
  acquisition_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'borrowed', 'maintenance')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.box_assets (
  box_id UUID NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (box_id, asset_id)
);

CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id UUID NOT NULL REFERENCES public.boxes(id),
  professor_id UUID REFERENCES public.profiles(id),
  responsible_name TEXT NOT NULL,
  room_id UUID NOT NULL REFERENCES public.rooms(id),
  session_class TEXT NOT NULL,
  borrowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_return_at TIMESTAMPTZ NOT NULL,
  returned_at TIMESTAMPTZ,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue')),
  created_by UUID REFERENCES auth.users(id),
  returned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.professor_lab_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id UUID NOT NULL REFERENCES public.labs(id),
  professor_id UUID REFERENCES public.profiles(id),
  responsible_name TEXT NOT NULL,
  session_class TEXT NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('ok', 'has_issues')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auditor_id UUID NOT NULL REFERENCES public.profiles(id),
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('functioning_normally', 'functioning_with_issue', 'not_functioning', 'missing')),
  powers_on BOOLEAN,
  internet_working BOOLEAN,
  keyboard_ok BOOLEAN,
  mouse_ok BOOLEAN,
  monitor_ok BOOLEAN,
  no_physical_damage BOOLEAN,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  reported_by UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'in_maintenance', 'resolved', 'discarded')),
  source TEXT CHECK (source IN ('audit', 'professor_checklist', 'return_flow', 'manual')),
  source_reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_profiles_modtime
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_asset_types_modtime
BEFORE UPDATE ON public.asset_types
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_labs_modtime
BEFORE UPDATE ON public.labs
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_rooms_modtime
BEFORE UPDATE ON public.rooms
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_assets_modtime
BEFORE UPDATE ON public.assets
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_boxes_modtime
BEFORE UPDATE ON public.boxes
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_loans_modtime
BEFORE UPDATE ON public.loans
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_checklists_modtime
BEFORE UPDATE ON public.professor_lab_checklists
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_incidents_modtime
BEFORE UPDATE ON public.incidents
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, CONCAT('anon-', NEW.id, '@anonymous.local')),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, CONCAT('anon-', NEW.id)), '@', 1), 'publico'),
    'professor'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_role() = 'admin', FALSE)
$$;

CREATE OR REPLACE FUNCTION public.request_loan(
  p_box_id UUID,
  p_responsible_name TEXT,
  p_room_id UUID,
  p_session_class TEXT,
  p_expected_return_at TIMESTAMPTZ,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan_id UUID;
  v_box_status TEXT;
BEGIN
  SELECT status
  INTO v_box_status
  FROM public.boxes
  WHERE id = p_box_id;

  IF v_box_status IS NULL THEN
    RAISE EXCEPTION 'Caixa não encontrada.';
  END IF;

  IF v_box_status <> 'available' THEN
    RAISE EXCEPTION 'A caixa selecionada não está disponível.';
  END IF;

  IF COALESCE(BTRIM(p_responsible_name), '') = '' THEN
    RAISE EXCEPTION 'Informe o responsável.';
  END IF;

  IF COALESCE(BTRIM(p_session_class), '') = '' THEN
    RAISE EXCEPTION 'Informe a turma ou disciplina.';
  END IF;

  INSERT INTO public.loans (
    box_id,
    responsible_name,
    room_id,
    session_class,
    expected_return_at,
    notes,
    status,
    created_by
  )
  VALUES (
    p_box_id,
    BTRIM(p_responsible_name),
    p_room_id,
    BTRIM(p_session_class),
    p_expected_return_at,
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    'active',
    auth.uid()
  )
  RETURNING id INTO v_loan_id;

  UPDATE public.boxes
  SET status = 'borrowed'
  WHERE id = p_box_id;

  RETURN v_loan_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.return_loan(p_loan_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_box_id UUID;
BEGIN
  SELECT box_id
  INTO v_box_id
  FROM public.loans
  WHERE id = p_loan_id
    AND status <> 'returned';

  IF v_box_id IS NULL THEN
    RAISE EXCEPTION 'Empréstimo não encontrado ou já devolvido.';
  END IF;

  UPDATE public.loans
  SET
    status = 'returned',
    returned_at = NOW(),
    returned_by = auth.uid()
  WHERE id = p_loan_id;

  UPDATE public.boxes
  SET status = 'available'
  WHERE id = v_box_id;

  RETURN p_loan_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_checklist(
  p_lab_id UUID,
  p_responsible_name TEXT,
  p_session_class TEXT,
  p_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checklist_id UUID;
BEGIN
  IF COALESCE(BTRIM(p_responsible_name), '') = '' THEN
    RAISE EXCEPTION 'Informe o responsável.';
  END IF;

  IF COALESCE(BTRIM(p_session_class), '') = '' THEN
    RAISE EXCEPTION 'Informe a disciplina.';
  END IF;

  IF p_status NOT IN ('ok', 'has_issues') THEN
    RAISE EXCEPTION 'Status de checklist inválido.';
  END IF;

  INSERT INTO public.professor_lab_checklists (
    lab_id,
    responsible_name,
    session_class,
    status,
    notes,
    created_by
  )
  VALUES (
    p_lab_id,
    BTRIM(p_responsible_name),
    BTRIM(p_session_class),
    p_status,
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    auth.uid()
  )
  RETURNING id INTO v_checklist_id;

  RETURN v_checklist_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_asset_context(p_asset_id UUID)
RETURNS TABLE (
  asset_id UUID,
  tag_code TEXT,
  qr_code_value TEXT,
  serial_number TEXT,
  host_name TEXT,
  domain_name TEXT,
  model TEXT,
  asset_status TEXT,
  lab_id UUID,
  lab_name TEXT,
  lab_location TEXT,
  box_id UUID,
  box_name TEXT,
  box_status TEXT,
  active_loan_id UUID,
  loan_status TEXT,
  borrowed_at TIMESTAMPTZ,
  expected_return_at TIMESTAMPTZ,
  responsible_name TEXT,
  session_class TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id AS asset_id,
    a.tag_code,
    a.qr_code_value,
    a.serial_number,
    a.host_name,
    a.domain_name,
    a.model,
    a.status AS asset_status,
    l.id AS lab_id,
    l.name AS lab_name,
    l.location AS lab_location,
    b.id AS box_id,
    b.name AS box_name,
    b.status AS box_status,
    ln.id AS active_loan_id,
    ln.status AS loan_status,
    ln.borrowed_at,
    ln.expected_return_at,
    ln.responsible_name,
    ln.session_class
  FROM public.assets a
  LEFT JOIN public.labs l ON l.id = a.lab_id
  LEFT JOIN public.box_assets ba ON ba.asset_id = a.id
  LEFT JOIN public.boxes b ON b.id = ba.box_id
  LEFT JOIN public.loans ln ON ln.box_id = b.id AND ln.status <> 'returned'
  WHERE a.id = p_asset_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.request_loan_by_asset(
  p_asset_id UUID,
  p_responsible_name TEXT,
  p_room_id UUID,
  p_session_class TEXT,
  p_expected_return_at TIMESTAMPTZ,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_box_id UUID;
BEGIN
  SELECT ba.box_id
  INTO v_box_id
  FROM public.box_assets ba
  INNER JOIN public.boxes b ON b.id = ba.box_id
  WHERE ba.asset_id = p_asset_id
  ORDER BY b.created_at
  LIMIT 1;

  IF v_box_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma caixa vinculada a este ativo.';
  END IF;

  RETURN public.request_loan(
    v_box_id,
    p_responsible_name,
    p_room_id,
    p_session_class,
    p_expected_return_at,
    p_notes
  );
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.box_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professor_lab_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_update_own_or_admin"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.is_admin())
WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY "asset_types_read_public"
ON public.asset_types FOR SELECT TO authenticated, anon
USING (TRUE);

CREATE POLICY "asset_types_write_admin"
ON public.asset_types FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "labs_read_public"
ON public.labs FOR SELECT TO authenticated, anon
USING (TRUE);

CREATE POLICY "labs_write_admin"
ON public.labs FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "rooms_read_public"
ON public.rooms FOR SELECT TO authenticated, anon
USING (TRUE);

CREATE POLICY "rooms_write_admin"
ON public.rooms FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "assets_read_admin"
ON public.assets FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "assets_write_admin"
ON public.assets FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "boxes_read_public"
ON public.boxes FOR SELECT TO authenticated, anon
USING (TRUE);

CREATE POLICY "boxes_write_admin"
ON public.boxes FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "box_assets_read_admin"
ON public.box_assets FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "box_assets_write_admin"
ON public.box_assets FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "loans_read_public"
ON public.loans FOR SELECT TO authenticated, anon
USING (TRUE);

CREATE POLICY "loans_write_admin"
ON public.loans FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "checklists_read_public"
ON public.professor_lab_checklists FOR SELECT TO authenticated, anon
USING (TRUE);

CREATE POLICY "checklists_write_admin"
ON public.professor_lab_checklists FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "audits_read_admin"
ON public.audits FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "audits_write_admin"
ON public.audits FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "incidents_read_admin"
ON public.incidents FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "incidents_write_admin"
ON public.incidents FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

GRANT EXECUTE ON FUNCTION public.request_loan(UUID, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_loan_by_asset(UUID, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_loan(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_checklist(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_asset_context(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_loan(UUID, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.request_loan_by_asset(UUID, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.return_loan(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_public_checklist(UUID, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_asset_context(UUID) TO anon;
