INSERT INTO public.asset_types (name, description) VALUES
  ('Notebook', 'Notebooks para professores e alunos'),
  ('Desktop', 'Estações de trabalho dos laboratórios'),
  ('Monitor', 'Monitores dos laboratórios'),
  ('Projetor', 'Projetores de sala de aula')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.labs (name, location) VALUES
  ('Laboratório 01', 'Prédio A - Andar 1'),
  ('Laboratório 02', 'Prédio A - Andar 1'),
  ('Laboratório Maker', 'Prédio B - Térreo')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.rooms (name, building) VALUES
  ('Sala 101', 'Prédio Principal'),
  ('Sala 102', 'Prédio Principal'),
  ('Auditório', 'Prédio Principal')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.boxes (name, description, status) VALUES
  ('Caixa 01 - Dell', 'Caixa com notebooks Dell Latitude', 'available'),
  ('Caixa 02 - Lenovo', 'Caixa com notebooks Lenovo ThinkPad', 'available')
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE
  v_admin_id UUID;
  v_admin_email CONSTANT TEXT := 'admin@findes.com';
  v_admin_password CONSTANT TEXT := 'Findes26';
BEGIN
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = v_admin_email;

  IF v_admin_id IS NULL THEN
    v_admin_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_admin_id,
      'authenticated',
      'authenticated',
      v_admin_email,
      crypt(v_admin_password, gen_salt('bf')),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Admin Findes"}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      v_admin_id,
      jsonb_build_object(
        'sub', v_admin_id::text,
        'email', v_admin_email,
        'email_verified', true
      ),
      'email',
      v_admin_email,
      NOW(),
      NOW(),
      NOW()
    );
  END IF;

  UPDATE public.profiles
  SET
    full_name = 'Admin Findes',
    role = 'admin',
    updated_at = NOW()
  WHERE id = v_admin_id;
END
$$;
