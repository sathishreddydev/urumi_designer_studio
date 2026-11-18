CREATE TABLE IF NOT EXISTS employee_public_holidays (
  date text PRIMARY KEY,
  name text NOT NULL,
  created_by varchar(20) REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT employee_public_holidays_valid_date
    CHECK (date ~ '^\d{4}-\d{2}-\d{2}$')
);
