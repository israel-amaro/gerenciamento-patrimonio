CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.labs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  building TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type_id UUID NOT NULL REFERENCES public.asset_types(id),
  tag_code TEXT NOT NULL UNIQUE,
  qr_code_value TEXT NOT NULL UNIQUE,
  serial_number TEXT,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'defective', 'missing', 'retired')),
  lab_id UUID REFERENCES public.labs(id),
  acquisition_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.boxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'borrowed', 'maintenance')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.box_assets (
  box_id UUID NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  PRIMARY KEY (box_id, asset_id)
);

CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  box_id UUID NOT NULL REFERENCES public.boxes(id),
  professor_id UUID NOT NULL REFERENCES public.profiles(id),
  room_id UUID NOT NULL REFERENCES public.rooms(id),
  session_class TEXT NOT NULL,
  borrowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_return_at TIMESTAMPTZ NOT NULL,
  returned_at TIMESTAMPTZ,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.professor_lab_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lab_id UUID NOT NULL REFERENCES public.labs(id),
  professor_id UUID NOT NULL REFERENCES public.profiles(id),
  session_class TEXT NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('ok', 'has_issues')),
  notes TEXT
);

CREATE TABLE public.professor_lab_checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID NOT NULL REFERENCES public.professor_lab_checklists(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id),
  issue_type TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE public.audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  notes TEXT
);

CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE TABLE public.maintenance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES public.profiles(id),
  action_taken TEXT NOT NULL,
  cost NUMERIC,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE public.notification_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  recipients JSONB NOT NULL DEFAULT '[]',
  webhook_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID REFERENCES public.incidents(id),
  sent_to TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_profiles_modtime
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER update_assets_modtime
BEFORE UPDATE ON public.assets
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
  ON CONFLICT (id) DO NOTHING;

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
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_role() IN ('admin', 'technician'), FALSE)
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
ALTER TABLE public.professor_lab_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_authenticated"
ON public.profiles FOR SELECT TO authenticated
USING (TRUE);

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.current_role() = 'admin')
WITH CHECK (id = auth.uid() OR public.current_role() = 'admin');

CREATE POLICY "asset_types_select_authenticated"
ON public.asset_types FOR SELECT TO authenticated
USING (TRUE);

CREATE POLICY "labs_select_authenticated"
ON public.labs FOR SELECT TO authenticated
USING (TRUE);

CREATE POLICY "rooms_select_authenticated"
ON public.rooms FOR SELECT TO authenticated
USING (TRUE);

CREATE POLICY "assets_select_authenticated"
ON public.assets FOR SELECT TO authenticated
USING (TRUE);

CREATE POLICY "assets_write_staff"
ON public.assets FOR ALL TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

CREATE POLICY "boxes_select_authenticated"
ON public.boxes FOR SELECT TO authenticated
USING (TRUE);

CREATE POLICY "boxes_write_staff"
ON public.boxes FOR ALL TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

CREATE POLICY "box_assets_select_authenticated"
ON public.box_assets FOR SELECT TO authenticated
USING (TRUE);

CREATE POLICY "box_assets_write_staff"
ON public.box_assets FOR ALL TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

CREATE POLICY "loans_select_scope"
ON public.loans FOR SELECT TO authenticated
USING (public.is_staff() OR professor_id = auth.uid());

CREATE POLICY "loans_insert_scope"
ON public.loans FOR INSERT TO authenticated
WITH CHECK (public.is_staff() OR professor_id = auth.uid());

CREATE POLICY "loans_update_scope"
ON public.loans FOR UPDATE TO authenticated
USING (public.is_staff() OR professor_id = auth.uid())
WITH CHECK (public.is_staff() OR professor_id = auth.uid());

CREATE POLICY "checklists_select_scope"
ON public.professor_lab_checklists FOR SELECT TO authenticated
USING (public.is_staff() OR professor_id = auth.uid());

CREATE POLICY "checklists_insert_scope"
ON public.professor_lab_checklists FOR INSERT TO authenticated
WITH CHECK (public.is_staff() OR professor_id = auth.uid());

CREATE POLICY "checklist_items_select_scope"
ON public.professor_lab_checklist_items FOR SELECT TO authenticated
USING (
  public.is_staff()
  OR EXISTS (
    SELECT 1
    FROM public.professor_lab_checklists c
    WHERE c.id = checklist_id AND c.professor_id = auth.uid()
  )
);

CREATE POLICY "checklist_items_insert_scope"
ON public.professor_lab_checklist_items FOR INSERT TO authenticated
WITH CHECK (
  public.is_staff()
  OR EXISTS (
    SELECT 1
    FROM public.professor_lab_checklists c
    WHERE c.id = checklist_id AND c.professor_id = auth.uid()
  )
);

CREATE POLICY "audits_select_authenticated"
ON public.audits FOR SELECT TO authenticated
USING (TRUE);

CREATE POLICY "audits_write_staff"
ON public.audits FOR ALL TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

CREATE POLICY "incidents_select_authenticated"
ON public.incidents FOR SELECT TO authenticated
USING (TRUE);

CREATE POLICY "incidents_insert_authenticated"
ON public.incidents FOR INSERT TO authenticated
WITH CHECK (reported_by = auth.uid());

CREATE POLICY "incidents_update_scope"
ON public.incidents FOR UPDATE TO authenticated
USING (public.is_staff() OR reported_by = auth.uid())
WITH CHECK (public.is_staff() OR reported_by = auth.uid());

CREATE POLICY "maintenance_select_staff"
ON public.maintenance_records FOR SELECT TO authenticated
USING (public.is_staff());

CREATE POLICY "maintenance_write_staff"
ON public.maintenance_records FOR ALL TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());
