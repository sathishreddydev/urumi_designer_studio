-- Add consultation date and expected delivery date to consultations table
ALTER TABLE "consultations"
  ADD COLUMN IF NOT EXISTS "consultation_date" timestamp,
  ADD COLUMN IF NOT EXISTS "expected_delivery_date" timestamp,
  ADD COLUMN IF NOT EXISTS "expected_trial_date" timestamp;
