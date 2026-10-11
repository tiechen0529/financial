import { sql } from "kysely";
import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE account_sets (
      id INT NOT NULL AUTO_INCREMENT,
      company_name VARCHAR(160) NOT NULL,
      base_currency CHAR(3) NOT NULL DEFAULT 'CNY',
      accounting_standard VARCHAR(40) NOT NULL,
      enabled_from DATE NOT NULL,
      current_period DATE NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `.execute(db);

  await sql`
    CREATE TABLE subjects (
      id INT NOT NULL AUTO_INCREMENT,
      account_set_id INT NOT NULL,
      code VARCHAR(32) NOT NULL,
      name VARCHAR(160) NOT NULL,
      parent_id INT NULL,
      balance_direction VARCHAR(8) NOT NULL,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_subjects_account_set_id_id (account_set_id, id),
      UNIQUE KEY uq_subjects_account_set_code (account_set_id, code),
      CONSTRAINT fk_subjects_account_set FOREIGN KEY (account_set_id)
        REFERENCES account_sets (id) ON DELETE RESTRICT,
      CONSTRAINT fk_subjects_parent FOREIGN KEY (account_set_id, parent_id)
        REFERENCES subjects (account_set_id, id) ON DELETE RESTRICT,
      CONSTRAINT ck_subjects_balance_direction CHECK (balance_direction IN ('debit', 'credit'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `.execute(db);

  await sql`
    CREATE TABLE accounting_periods (
      id INT NOT NULL AUTO_INCREMENT,
      account_set_id INT NOT NULL,
      year SMALLINT NOT NULL,
      month TINYINT NOT NULL,
      status VARCHAR(12) NOT NULL DEFAULT 'open',
      closed_at TIMESTAMP NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_periods_account_set_year_month (account_set_id, year, month),
      CONSTRAINT fk_periods_account_set FOREIGN KEY (account_set_id)
        REFERENCES account_sets (id) ON DELETE RESTRICT,
      CONSTRAINT ck_periods_month CHECK (month BETWEEN 1 AND 12),
      CONSTRAINT ck_periods_status CHECK (status IN ('open', 'closing', 'closed'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `.execute(db);

  await sql`
    CREATE TABLE vouchers (
      id INT NOT NULL AUTO_INCREMENT,
      account_set_id INT NOT NULL,
      voucher_date DATE NOT NULL,
      period_year SMALLINT NOT NULL,
      period_month TINYINT NOT NULL,
      voucher_word VARCHAR(24) NOT NULL,
      voucher_number INT NOT NULL,
      status VARCHAR(12) NOT NULL DEFAULT 'draft',
      debit_total DECIMAL(24, 8) NOT NULL DEFAULT 0,
      credit_total DECIMAL(24, 8) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_vouchers_account_set_id_id (account_set_id, id),
      UNIQUE KEY uq_vouchers_period_number (account_set_id, period_year, period_month, voucher_word, voucher_number),
      KEY idx_vouchers_account_set_date (account_set_id, voucher_date),
      CONSTRAINT fk_vouchers_account_set FOREIGN KEY (account_set_id)
        REFERENCES account_sets (id) ON DELETE RESTRICT,
      CONSTRAINT ck_vouchers_status CHECK (status IN ('draft', 'posted', 'void')),
      CONSTRAINT ck_vouchers_month CHECK (period_month BETWEEN 1 AND 12),
      CONSTRAINT ck_vouchers_totals CHECK (debit_total >= 0 AND credit_total >= 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `.execute(db);

  await sql`
    CREATE TABLE voucher_lines (
      id INT NOT NULL AUTO_INCREMENT,
      account_set_id INT NOT NULL,
      voucher_id INT NOT NULL,
      line_number SMALLINT NOT NULL,
      subject_id INT NOT NULL,
      summary VARCHAR(512) NOT NULL DEFAULT '',
      debit_amount DECIMAL(24, 8) NOT NULL DEFAULT 0,
      credit_amount DECIMAL(24, 8) NOT NULL DEFAULT 0,
      quantity DECIMAL(24, 8) NULL,
      unit_price DECIMAL(24, 8) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_voucher_lines_voucher_line (voucher_id, line_number),
      KEY idx_voucher_lines_account_subject (account_set_id, subject_id),
      CONSTRAINT fk_voucher_lines_voucher FOREIGN KEY (account_set_id, voucher_id)
        REFERENCES vouchers (account_set_id, id) ON DELETE CASCADE,
      CONSTRAINT fk_voucher_lines_subject FOREIGN KEY (account_set_id, subject_id)
        REFERENCES subjects (account_set_id, id) ON DELETE RESTRICT,
      CONSTRAINT ck_voucher_lines_amounts CHECK (
        debit_amount >= 0 AND credit_amount >= 0 AND NOT (debit_amount > 0 AND credit_amount > 0)
      )
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS voucher_lines`.execute(db);
  await sql`DROP TABLE IF EXISTS vouchers`.execute(db);
  await sql`DROP TABLE IF EXISTS accounting_periods`.execute(db);
  await sql`DROP TABLE IF EXISTS subjects`.execute(db);
  await sql`DROP TABLE IF EXISTS account_sets`.execute(db);
}
