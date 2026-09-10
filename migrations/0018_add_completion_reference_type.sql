-- Add COMPLETION to reference_type enum
ALTER TYPE reference_type ADD VALUE IF NOT EXISTS 'COMPLETION';

-- Migrate existing completion photos: FABRIC + isWorkPhoto=true → COMPLETION
UPDATE reference_images
SET type = 'COMPLETION'
WHERE type = 'FABRIC' AND is_work_photo = true;
