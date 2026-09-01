-- Add add-ons JSONB column to outfits
-- Stores sourced/external items attached to an outfit (e.g. dupatta, lining)
-- Format: [{ id: string, name: string, price: number, notes?: string }]
ALTER TABLE outfits ADD COLUMN IF NOT EXISTS add_ons JSONB DEFAULT NULL;
