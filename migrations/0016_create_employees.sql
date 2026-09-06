-- ─── Employee enums ──────────────────────────────────────────────────────────

CREATE TYPE "employee_pay_cycle" AS ENUM ('WEEKLY', 'MONTHLY');
CREATE TYPE "attendance_status"  AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'HOLIDAY');
CREATE TYPE "advance_status"     AS ENUM ('OUTSTANDING', 'PARTIALLY_RECOVERED', 'RECOVERED');

-- ─── employees ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "employees" (
  "id"             varchar(20)          PRIMARY KEY,
  "name"           text                 NOT NULL,
  "phone"          text                 NOT NULL UNIQUE,
  "job_role"       text                 NOT NULL,
  "pay_cycle"      "employee_pay_cycle" NOT NULL DEFAULT 'MONTHLY',
  "salary_amount"  decimal(10,2)        NOT NULL,
  "shift_start"    text,
  "shift_end"      text,
  "active"         boolean              NOT NULL DEFAULT true,
  "notes"          text,
  "created_at"     timestamp            NOT NULL DEFAULT now(),
  "updated_at"     timestamp            NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_employees_active" ON "employees"("active");

-- ─── employee_attendance ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "employee_attendance" (
  "id"           varchar(20)         PRIMARY KEY,
  "employee_id"  varchar(20)         NOT NULL REFERENCES "employees"("id"),
  "date"         text                NOT NULL,
  "status"       "attendance_status" NOT NULL,
  "check_in"     text,
  "check_out"    text,
  "notes"        text,
  "recorded_by"  varchar(20)         REFERENCES "users"("id"),
  "created_at"   timestamp           NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_attendance_employee_date"
  ON "employee_attendance"("employee_id", "date");
CREATE INDEX IF NOT EXISTS "idx_attendance_date" ON "employee_attendance"("date");

-- ─── employee_salary_payments ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "employee_salary_payments" (
  "id"            varchar(20)      PRIMARY KEY,
  "employee_id"   varchar(20)      NOT NULL REFERENCES "employees"("id"),
  "period_start"  text             NOT NULL,
  "period_end"    text             NOT NULL,
  "gross_amount"  decimal(10,2)    NOT NULL,
  "deductions"    decimal(10,2)    NOT NULL DEFAULT 0,
  "net_amount"    decimal(10,2)    NOT NULL,
  "method"        "payment_method" NOT NULL DEFAULT 'CASH',
  "paid_at"       timestamp        NOT NULL DEFAULT now(),
  "paid_by"       varchar(20)      REFERENCES "users"("id"),
  "notes"         text,
  "created_at"    timestamp        NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_salary_employee" ON "employee_salary_payments"("employee_id");

-- ─── employee_advances ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "employee_advances" (
  "id"                varchar(20)       PRIMARY KEY,
  "employee_id"       varchar(20)       NOT NULL REFERENCES "employees"("id"),
  "amount"            decimal(10,2)     NOT NULL,
  "reason"            text,
  "issued_at"         timestamp         NOT NULL DEFAULT now(),
  "issued_by"         varchar(20)       REFERENCES "users"("id"),
  "recovered_amount"  decimal(10,2)     NOT NULL DEFAULT 0,
  "status"            "advance_status"  NOT NULL DEFAULT 'OUTSTANDING',
  "notes"             text,
  "created_at"        timestamp         NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_advances_employee" ON "employee_advances"("employee_id");
CREATE INDEX IF NOT EXISTS "idx_advances_status"   ON "employee_advances"("status");
