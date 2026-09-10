-- Drop deprecated is_work_photo column (replaced by COMPLETION type enum)
ALTER TABLE reference_images DROP COLUMN IF EXISTS is_work_photo;
