CREATE TABLE IF NOT EXISTS employee_employment_periods (
  employee_id varchar(20) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date text NOT NULL,
  end_date text,
  PRIMARY KEY (employee_id, start_date),
  CONSTRAINT employee_employment_periods_valid_dates
    CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Preserve an initial employment window for existing employees. Administrators
-- can edit these dates to record historical breaks and re-joining periods.
INSERT INTO employee_employment_periods (employee_id, start_date, end_date)
SELECT
  id,
  to_char(created_at::date, 'YYYY-MM-DD'),
  CASE WHEN active THEN NULL ELSE to_char(updated_at::date, 'YYYY-MM-DD') END
FROM employees
ON CONFLICT (employee_id, start_date) DO NOTHING;