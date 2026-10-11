import { sql } from "kysely";
import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE subjects
      ADD COLUMN subject_type VARCHAR(24) NOT NULL DEFAULT '资产' AFTER name,
      ADD COLUMN opening_debit DECIMAL(24, 8) NOT NULL DEFAULT 0 AFTER is_enabled,
      ADD COLUMN opening_credit DECIMAL(24, 8) NOT NULL DEFAULT 0 AFTER opening_debit
  `.execute(db);

  await sql`
    INSERT INTO accounting_periods (account_set_id, year, month)
    SELECT account_sets.id, YEAR(account_sets.current_period), MONTH(account_sets.current_period)
    FROM account_sets
    LEFT JOIN accounting_periods
      ON accounting_periods.account_set_id = account_sets.id
      AND accounting_periods.year = YEAR(account_sets.current_period)
      AND accounting_periods.month = MONTH(account_sets.current_period)
    WHERE accounting_periods.id IS NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE subjects
    DROP COLUMN opening_credit,
    DROP COLUMN opening_debit,
    DROP COLUMN subject_type
  `.execute(db);
}
