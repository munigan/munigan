-- Preserve the original saving decision even if an anonymous report is claimed later.
ALTER TABLE tg_jobs ADD COLUMN admission_account_id text;
UPDATE tg_jobs SET admission_account_id=account_id;
