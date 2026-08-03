-- 118: Fix all remaining public-schema FKs from auth.users → profiles
-- Required for PostgREST joins using profiles!column or profiles!constraint syntax.

-- leave_requests
ALTER TABLE leave_requests DROP CONSTRAINT leave_requests_employee_user_id_fkey;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_employee_user_id_fkey
  FOREIGN KEY (employee_user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE leave_requests DROP CONSTRAINT leave_requests_reviewed_by_fkey;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- offboarding_checklists
ALTER TABLE offboarding_checklists DROP CONSTRAINT offboarding_checklists_employee_user_id_fkey;
ALTER TABLE offboarding_checklists ADD CONSTRAINT offboarding_checklists_employee_user_id_fkey
  FOREIGN KEY (employee_user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- payroll_entries
ALTER TABLE payroll_entries DROP CONSTRAINT payroll_entries_employee_user_id_fkey;
ALTER TABLE payroll_entries ADD CONSTRAINT payroll_entries_employee_user_id_fkey
  FOREIGN KEY (employee_user_id) REFERENCES profiles(id) ON DELETE CASCADE;
