-- 116: Fix employee_records FK to point profiles (not auth.users)
-- PostgREST's profiles!user_id join requires FK → public.profiles.id,
-- not auth.users.id. Same UUIDs — just need the correct target schema.

ALTER TABLE employee_records
  DROP CONSTRAINT employee_records_user_id_fkey;

ALTER TABLE employee_records
  ADD CONSTRAINT employee_records_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE employee_records
  DROP CONSTRAINT employee_records_manager_user_id_fkey;

ALTER TABLE employee_records
  ADD CONSTRAINT employee_records_manager_user_id_fkey
  FOREIGN KEY (manager_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
