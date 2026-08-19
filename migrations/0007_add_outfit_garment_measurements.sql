-- Add garment_measurements JSON column to outfits.
-- Stores garment-specific measurements (Front Length, Neck Front, etc.) directly
-- on the outfit, separate from the customer-level body measurements snapshot.
-- Nullable: existing outfits will have NULL until measurements are entered.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'outfits'
      AND column_name = 'garment_measurements'
  ) THEN
    ALTER TABLE outfits
      ADD COLUMN garment_measurements JSONB;
  END IF;
END $$;
