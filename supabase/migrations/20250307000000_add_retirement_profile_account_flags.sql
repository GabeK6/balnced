-- Add optional account flags to retirement_profiles.
-- When false, that account is excluded from projections and recommendations.
-- Existing rows get default false (opt-in).

ALTER TABLE retirement_profiles
  ADD COLUMN IF NOT EXISTS has_roth_ira boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_401k boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_employer_match boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN retirement_profiles.has_roth_ira IS 'When true, Roth balance and contributions are included in projection.';
COMMENT ON COLUMN retirement_profiles.has_401k IS 'When true, 401(k) balance and contributions are included in projection.';
COMMENT ON COLUMN retirement_profiles.has_employer_match IS 'When true and has_401k is true, employer match is included in projection.';
