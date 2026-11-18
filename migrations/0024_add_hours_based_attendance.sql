ALTER TABLE employee_attendance
  ADD COLUMN IF NOT EXISTS worked_hours decimal(5,2),
  ADD COLUMN IF NOT EXISTS regular_shift_hours decimal(5,2),
  ADD COLUMN IF NOT EXISTS entry_mode text;

CREATE TABLE IF NOT EXISTS employee_payroll_settings (
  id varchar(20) PRIMARY KEY,
  shift_start text NOT NULL,
  shift_end text NOT NULL,
  break_minutes integer NOT NULL DEFAULT 30,
  updated_by varchar(20) REFERENCES users(id),
  updated_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO employee_payroll_settings (id, shift_start, shift_end, break_minutes)
VALUES ('default', '11:00', '20:00', 30)
ON CONFLICT (id) DO NOTHING;