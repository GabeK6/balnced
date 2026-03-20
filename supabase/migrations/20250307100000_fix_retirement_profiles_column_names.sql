-- Fix column name typo: k401_balnce -> k401_balance (if your table has the typo).
-- Run this in Supabase SQL Editor if you get "Could not find the 'k401_balance' column" when saving retirement.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'retirement_profiles'
      AND column_name = 'k401_balnce'
  ) THEN
    ALTER TABLE retirement_profiles RENAME COLUMN k401_balnce TO k401_balance;
  END IF;
END $$;
