-- Track actual trial and delivery timestamps, separate from the planned dates.
-- trialDate / deliveryDate = planned dates set by staff.
-- trialedAt / deliveredAt = actual timestamps stamped automatically on status transition.
ALTER TABLE "outfits"
  ADD COLUMN IF NOT EXISTS "trialed_at" timestamp,
  ADD COLUMN IF NOT EXISTS "delivered_at" timestamp;
