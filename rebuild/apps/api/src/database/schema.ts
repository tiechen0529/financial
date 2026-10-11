import type { Generated } from "kysely";

/** DECIMAL values cross the SQL boundary as strings, never binary floating-point numbers. */
export type DecimalString = string;
export type PeriodStatus = "open" | "closing" | "closed";
export type VoucherStatus = "draft" | "posted" | "void";
export type BalanceDirection = "debit" | "credit";

export interface AccountSetsTable {
  id: Generated<number>;
  company_name: string;
  base_currency: string;
  accounting_standard: string;
  enabled_from: string;
  current_period: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface SubjectsTable {
  id: Generated<number>;
  account_set_id: number;
  code: string;
  name: string;
  parent_id: number | null;
  balance_direction: BalanceDirection;
  is_enabled: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface AccountingPeriodsTable {
  id: Generated<number>;
  account_set_id: number;
  year: number;
  month: number;
  status: Generated<PeriodStatus>;
  closed_at: Date | null;
}

export interface VouchersTable {
  id: Generated<number>;
  account_set_id: number;
  voucher_date: string;
  period_year: number;
  period_month: number;
  voucher_word: string;
  voucher_number: number;
  status: Generated<VoucherStatus>;
  debit_total: DecimalString;
  credit_total: DecimalString;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface VoucherLinesTable {
  id: Generated<number>;
  account_set_id: number;
  voucher_id: number;
  line_number: number;
  subject_id: number;
  summary: string;
  debit_amount: DecimalString;
  credit_amount: DecimalString;
  quantity: DecimalString | null;
  unit_price: DecimalString | null;
}

export interface FinancialDatabase {
  account_sets: AccountSetsTable;
  accounting_periods: AccountingPeriodsTable;
  subjects: SubjectsTable;
  voucher_lines: VoucherLinesTable;
  vouchers: VouchersTable;
}
