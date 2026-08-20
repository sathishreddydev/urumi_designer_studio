-- Add voice_notes JSONB column to outfits table
ALTER TABLE outfits ADD COLUMN IF NOT EXISTS voice_notes jsonb;
