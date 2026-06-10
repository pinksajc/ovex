-- Fix handle_new_user trigger to include role and status
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, status)
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(COALESCE(new.email, ''), '@', 1)
    ),
    COALESCE(new.raw_user_meta_data->>'role', 'admin'),
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    role = COALESCE(EXCLUDED.role, profiles.role),
    status = COALESCE(EXCLUDED.status, profiles.status);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
