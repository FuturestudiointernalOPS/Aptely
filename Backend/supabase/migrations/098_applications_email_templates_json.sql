-- 098_applications_email_templates_json.sql
-- finalize-selection / email-preview / send-emails persist editable selection email
-- templates per application. The column was referenced in code but never created
-- (causing 500s on those routes). Add it.

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS email_templates_json JSONB;
