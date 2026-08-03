-- 117: Fix performance_reviews FK to reference profiles (not auth.users)
-- Required for PostgREST profiles!fk_name join syntax.

ALTER TABLE performance_reviews
  DROP CONSTRAINT performance_reviews_reviewer_user_id_fkey;
ALTER TABLE performance_reviews
  ADD CONSTRAINT performance_reviews_reviewer_user_id_fkey
  FOREIGN KEY (reviewer_user_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE performance_reviews
  DROP CONSTRAINT performance_reviews_employee_user_id_fkey;
ALTER TABLE performance_reviews
  ADD CONSTRAINT performance_reviews_employee_user_id_fkey
  FOREIGN KEY (employee_user_id) REFERENCES profiles(id) ON DELETE CASCADE;
