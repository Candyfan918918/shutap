-- Create the seed auth user (no password, never signs in)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
)
VALUES (
  '00000000-0000-0000-0000-000000005ee0',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'examples@shutap.internal', '',
  now(),
  '{"provider":"system","providers":["system"]}'::jsonb,
  '{"locale":"en"}'::jsonb,
  now(), now(), '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;