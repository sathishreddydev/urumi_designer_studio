-- Canonicalize explicit international numbers, and normalize only unambiguous
-- 10-digit Indian mobile values that have no country code. Other local formats
-- and employee numbers that would collide are left unchanged.

WITH candidates AS (
  SELECT
    id,
    phone,
    regexp_replace(phone, '[^0-9]', '', 'g') AS digits
  FROM users
  WHERE phone IS NOT NULL
    AND phone ~ '^[+0-9().[:space:]-]+$'
), normalized AS (
  SELECT
    id,
    phone,
    CASE
      WHEN phone LIKE '+%' AND length(digits) BETWEEN 7 AND 15 THEN '+' || digits
      WHEN digits ~ '^[6-9][0-9]{9}$' THEN '+91' || digits
      ELSE NULL
    END AS normalized_phone
  FROM candidates
)
UPDATE users user_record
SET phone = normalized.normalized_phone
FROM normalized
WHERE user_record.id = normalized.id
  AND normalized.normalized_phone IS NOT NULL
  AND user_record.phone <> normalized.normalized_phone;

WITH candidates AS (
  SELECT
    id,
    phone,
    regexp_replace(phone, '[^0-9]', '', 'g') AS digits
  FROM employees
  WHERE phone ~ '^[+0-9().[:space:]-]+$'
), normalized AS (
  SELECT
    id,
    phone,
    CASE
      WHEN phone LIKE '+%' AND length(digits) BETWEEN 7 AND 15 THEN '+' || digits
      WHEN digits ~ '^[6-9][0-9]{9}$' THEN '+91' || digits
      ELSE NULL
    END AS normalized_phone
  FROM candidates
), candidates_to_update AS (
  SELECT id, phone, normalized_phone
  FROM normalized
  WHERE normalized_phone IS NOT NULL
    AND phone <> normalized_phone
), unambiguous AS (
  SELECT candidate.id, candidate.normalized_phone
  FROM candidates_to_update candidate
  WHERE NOT EXISTS (
    SELECT 1
    FROM candidates_to_update duplicate
    WHERE duplicate.normalized_phone = candidate.normalized_phone
      AND duplicate.id <> candidate.id
  )
    AND NOT EXISTS (
      SELECT 1
      FROM employees existing
      WHERE existing.phone = candidate.normalized_phone
        AND existing.id <> candidate.id
    )
)
UPDATE employees employee
SET phone = unambiguous.normalized_phone,
    updated_at = now()
FROM unambiguous
WHERE employee.id = unambiguous.id;
