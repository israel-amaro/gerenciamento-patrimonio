-- Example seed data
INSERT INTO asset_types (name, description) VALUES
  ('Notebook', 'Laptop computers for professors/students'),
  ('Desktop', 'Lab workstations'),
  ('Monitor', 'Lab monitors'),
  ('Projector', 'Classroom projectors');

INSERT INTO labs (name, location) VALUES
  ('Laboratório 01', 'Prédio A, Andar 1'),
  ('Laboratório 02', 'Prédio A, Andar 1'),
  ('Laboratório Maker', 'Prédio B, Andar Térreo');

INSERT INTO rooms (name, building) VALUES
  ('Sala 101', 'Prédio Principal'),
  ('Sala 102', 'Prédio Principal'),
  ('Auditório', 'Prédio Principal');

INSERT INTO boxes (name, description, status) VALUES
  ('Caixa 01 - Dell', 'Caixa com 40 notebooks Dell Latitude', 'available'),
  ('Caixa 02 - Lenovo', 'Caixa com 40 notebooks Lenovo ThinkPad', 'available');

-- Note: In a real scenario, you'd insert profiles by creating users in auth.users first.
-- The assets table would be populated via CSV import or script generating UUIDs.
