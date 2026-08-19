-- Add measurement_snapshot_id to outfits so each outfit remembers exactly
-- which measurement version was active when it was created / sent to production.
-- Nullable: outfits created before this migration will have NULL (falls back to latest).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'outfits'
      AND column_name = 'measurement_snapshot_id'
  ) THEN
    ALTER TABLE outfits
      ADD COLUMN measurement_snapshot_id VARCHAR(20)
      REFERENCES customer_measurements(id) ON DELETE SET NULL;
  END IF;
END $$;
