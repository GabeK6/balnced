-- Store enabled retirement accounts and their settings in a flexible JSON schema.
-- This replaces the hardcoded Roth IRA / 401(k) columns for future expansion.
ALTER TABLE retirement_profiles
  ADD COLUMN IF NOT EXISTS retirement_accounts jsonb;

COMMENT ON COLUMN retirement_profiles.retirement_accounts IS
  'JSONB map of enabled retirement account types to their settings (invested accounts + pension income).';

