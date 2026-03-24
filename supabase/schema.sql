-- Enable UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'technician', 'professor')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asset Types (Categories like 'Notebook', 'Desktop', 'Monitor')
CREATE TABLE asset_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Labs
CREATE TABLE labs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms (For box loans, etc)
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  building TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assets
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type_id UUID REFERENCES asset_types(id) NOT NULL,
  tag_code TEXT UNIQUE NOT NULL,       -- Patrimony Code
  qr_code_value TEXT UNIQUE NOT NULL,
  serial_number TEXT,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'defective', 'missing', 'retired')),
  lab_id UUID REFERENCES labs(id),     -- Null if it's a mobile asset not assigned to a lab
  acquisition_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Boxes/Lots
CREATE TABLE boxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,           -- e.g., 'Caixa 01 - Notebooks'
  description TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'borrowed', 'maintenance')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Box Assets mapping
CREATE TABLE box_assets (
  box_id UUID REFERENCES boxes(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  PRIMARY KEY (box_id, asset_id)
);

-- Loans
CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  box_id UUID REFERENCES boxes(id) NOT NULL,
  professor_id UUID REFERENCES profiles(id) NOT NULL,
  room_id UUID REFERENCES rooms(id) NOT NULL,
  session_class TEXT NOT NULL,
  borrowed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expected_return_at TIMESTAMPTZ NOT NULL,
  returned_at TIMESTAMPTZ,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Professor Lab Checklists
CREATE TABLE professor_lab_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lab_id UUID REFERENCES labs(id) NOT NULL,
  professor_id UUID REFERENCES profiles(id) NOT NULL,
  session_class TEXT NOT NULL,
  reported_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'has_issues')),
  notes TEXT
);

-- Professor Lab Checklist Items (specifically marked issues)
CREATE TABLE professor_lab_checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID REFERENCES professor_lab_checklists(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES assets(id), -- Optional if they just report something general
  issue_type TEXT NOT NULL,            -- e.g., 'not_turning_on', 'no_internet', 'missing_peripheral'
  notes TEXT
);

-- Audits (Technical)
CREATE TABLE audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auditor_id UUID REFERENCES profiles(id) NOT NULL,
  asset_id UUID REFERENCES assets(id) NOT NULL,
  audited_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('functioning_normally', 'functioning_with_issue', 'not_functioning', 'missing')),
  powers_on BOOLEAN,
  internet_working BOOLEAN,
  keyboard_ok BOOLEAN,
  mouse_ok BOOLEAN,
  monitor_ok BOOLEAN,
  no_physical_damage BOOLEAN,
  notes TEXT
);

-- Incidents / Defects
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES assets(id) NOT NULL,
  reported_by UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'in_maintenance', 'resolved', 'discarded')),
  source TEXT CHECK (source IN ('audit', 'professor_checklist', 'return_flow', 'manual')),
  source_reference_id UUID, -- ID to audit, loan, or checklist
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Maintenance Records
CREATE TABLE maintenance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES profiles(id) NOT NULL,
  action_taken TEXT NOT NULL,
  cost NUMERIC,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Notifications
CREATE TABLE notification_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Singleton table
  recipients JSONB NOT NULL DEFAULT '[]',      -- array of emails
  webhook_url TEXT,
  enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID REFERENCES incidents(id),
  sent_to TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Set updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_assets_modtime BEFORE UPDATE ON assets FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_incidents_modtime BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Row Level Security (RLS) policies

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE professor_lab_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE professor_lab_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users for most operational tables
CREATE POLICY "Allow read access to authenticated users" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access to authenticated users" ON asset_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access to authenticated users" ON labs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access to authenticated users" ON rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access to authenticated users" ON assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access to authenticated users" ON boxes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access to authenticated users" ON box_assets FOR SELECT TO authenticated USING (true);

-- Loans policies: Professors can see their loans, Admins/Techs can see all
CREATE POLICY "Profs see own loans, admins see all" ON loans FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role IN ('admin', 'technician') OR profiles.id = loans.professor_id))
);

-- Insert policies will be more permissive for authenticated users to avoid complex setups here, 
-- but normally restricted by role.
CREATE POLICY "Allow insert for auth users" ON loans FOR INSERT TO authenticated WITH CHECK (auth.uid() = professor_id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'technician')));

