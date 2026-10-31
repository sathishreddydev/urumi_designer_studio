CREATE TABLE IF NOT EXISTS employee_salary_carryovers (
  id varchar(20) PRIMARY KEY,
  employee_id varchar(20) NOT NULL REFERENCES employees(id),
  source_period_start text NOT NULL,
  source_period_end text NOT NULL,
  target_period_start text NOT NULL,
  target_period_end text NOT NULL,
  amount decimal(10,2) NOT NULL CHECK (amount > 0),
  salary_payment_id varchar(20) REFERENCES employee_salary_payments(id),
  created_at timestamp NOT NULL DEFAULT now(),
  applied_at timestamp,
  created_by varchar(20) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_salary_carryover_target
  ON employee_salary_carryovers (employee_id, target_period_start, target_period_end);