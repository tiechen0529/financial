export interface HealthStatus {
  status: "ok";
}

export interface AccountSet {
  id: number;
  company_name: string;
  base_currency: string;
  accounting_standard: string;
  enabled_from: string;
  current_period: string;
}

export interface CreateAccountSetInput {
  companyName: string;
  baseCurrency?: string;
  accountingStandard: string;
  enabledFrom: string;
  currentPeriod: string;
}

interface DataEnvelope<T> {
  data: T;
}

export async function getHealth(
  fetcher: typeof fetch = fetch,
): Promise<HealthStatus> {
  const response = await fetcher("/api/v1/health", {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`API health check failed (${response.status})`);
  }
  return (await response.json()) as HealthStatus;
}

export async function checkDatabaseReadiness(
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher("/api/v1/health/ready", {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Database readiness check failed (${response.status})`);
  }
}

export async function listAccountSets(
  fetcher: typeof fetch = fetch,
): Promise<AccountSet[]> {
  const response = await fetcher("/api/v1/account-sets", {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Could not load account sets (${response.status})`);
  }
  const result = (await response.json()) as DataEnvelope<AccountSet[]>;
  return result.data;
}

export async function createAccountSet(
  input: CreateAccountSetInput,
  fetcher: typeof fetch = fetch,
): Promise<AccountSet> {
  const response = await fetcher("/api/v1/account-sets", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Could not create account set (${response.status})`);
  }
  const result = (await response.json()) as DataEnvelope<AccountSet>;
  return result.data;
}

export interface Subject {
  id: number;
  account_set_id: number;
  code: string;
  name: string;
  parent_id: number | null;
  balance_direction: "debit" | "credit";
  subject_type: string;
  is_enabled: boolean;
  opening_debit: string;
  opening_credit: string;
}

export interface SubjectInput {
  code: string;
  name: string;
  parentId: number | null;
  balanceDirection: "debit" | "credit";
  subjectType: string;
  openingDebit: string;
  openingCredit: string;
}

export interface VoucherLineInput {
  subjectId: number;
  summary: string;
  debitAmount: string;
  creditAmount: string;
}

export interface VoucherLine {
  id: number;
  account_set_id: number;
  voucher_id: number;
  line_number: number;
  subject_id: number;
  summary: string;
  debit_amount: string;
  credit_amount: string;
  quantity: string | null;
  unit_price: string | null;
}

export interface Voucher {
  id: number;
  account_set_id: number;
  voucher_date: string;
  period_year: number;
  period_month: number;
  voucher_word: string;
  voucher_number: number;
  status: "draft" | "posted" | "void";
  debit_total: string;
  credit_total: string;
  lines: VoucherLine[];
}

export interface VoucherInput {
  voucherDate: string;
  voucherWord: string;
  lines: VoucherLineInput[];
}

export interface TrialBalanceLine {
  id: number;
  code: string;
  name: string;
  subject_type: string;
  parent_id: number | null;
  is_enabled: boolean;
  has_children: boolean;
  beginningDebit: string;
  beginningCredit: string;
  currentDebit: string;
  currentCredit: string;
  endingDebit: string;
  endingCredit: string;
}

export interface TrialBalance {
  period: { year: number; month: number };
  lines: TrialBalanceLine[];
  total: Omit<
    TrialBalanceLine,
    | "id"
    | "code"
    | "name"
    | "subject_type"
    | "parent_id"
    | "is_enabled"
    | "has_children"
    | "balance_direction"
  >;
}

export interface AccountingPeriod {
  id: number;
  account_set_id: number;
  year: number;
  month: number;
  status: "open" | "closing" | "closed";
  closed_at: string | null;
}

async function requestData<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let message = `请求失败 (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (body.message) {
        message = Array.isArray(body.message)
          ? body.message.join("；")
          : body.message;
      }
    } catch {
      // Keep the status message when the response isn't JSON.
    }
    throw new Error(message);
  }
  const envelope = (await response.json()) as DataEnvelope<T>;
  return envelope.data;
}

const accountSetPath = (accountSetId: number) =>
  `/api/v1/account-sets/${accountSetId}`;

export function listSubjects(accountSetId: number): Promise<Subject[]> {
  return requestData(`${accountSetPath(accountSetId)}/subjects`);
}

export function initializeSubjects(
  accountSetId: number,
): Promise<{ inserted: number }> {
  return requestData(`${accountSetPath(accountSetId)}/subjects/initialize`, {
    method: "POST",
    body: "{}",
  });
}

export function createSubject(
  accountSetId: number,
  input: SubjectInput,
): Promise<Subject> {
  return requestData(`${accountSetPath(accountSetId)}/subjects`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSubjectOpeningBalance(
  accountSetId: number,
  subjectId: number,
  debit: string,
  credit: string,
): Promise<Subject> {
  return requestData(
    `${accountSetPath(accountSetId)}/subjects/${subjectId}/opening-balance`,
    { method: "PATCH", body: JSON.stringify({ debit, credit }) },
  );
}

export function listVouchers(
  accountSetId: number,
  year: number,
  month: number,
): Promise<Voucher[]> {
  return requestData(
    `${accountSetPath(accountSetId)}/vouchers?year=${year}&month=${month}`,
  );
}

export function createVoucher(
  accountSetId: number,
  input: VoucherInput,
): Promise<Voucher> {
  return requestData(`${accountSetPath(accountSetId)}/vouchers`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateVoucher(
  accountSetId: number,
  voucherId: number,
  input: VoucherInput,
): Promise<Voucher> {
  return requestData(`${accountSetPath(accountSetId)}/vouchers/${voucherId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function postVoucher(
  accountSetId: number,
  voucherId: number,
): Promise<Voucher> {
  return requestData(
    `${accountSetPath(accountSetId)}/vouchers/${voucherId}/post`,
    { method: "POST", body: "{}" },
  );
}

export function deleteVoucher(
  accountSetId: number,
  voucherId: number,
): Promise<{ deleted: boolean }> {
  return requestData(`${accountSetPath(accountSetId)}/vouchers/${voucherId}`, {
    method: "DELETE",
  });
}

export function getTrialBalance(
  accountSetId: number,
  year: number,
  month: number,
): Promise<TrialBalance> {
  return requestData(
    `${accountSetPath(accountSetId)}/reports/trial-balance?year=${year}&month=${month}`,
  );
}

export interface BalanceSheet {
  period: { year: number; month: number };
  basis: string;
  assets: Array<{ code: string; name: string; amount: string }>;
  liabilities: Array<{ code: string; name: string; amount: string }>;
  equity: Array<{ code: string; name: string; amount: string }>;
  other: Array<{
    code: string;
    name: string;
    amount: string;
    side: "assets" | "liabilities";
  }>;
  currentYearProfit: string;
  totals: {
    assets: string;
    liabilities: string;
    equity: string;
    liabilitiesAndEquity: string;
    difference: string;
    balanced: boolean;
  };
}

export function getBalanceSheet(
  accountSetId: number,
  year: number,
  month: number,
): Promise<BalanceSheet> {
  return requestData(
    `${accountSetPath(accountSetId)}/reports/balance-sheet?year=${year}&month=${month}`,
  );
}

export interface IncomeStatement {
  period: { year: number; month: number };
  name: string;
  lines: Array<{
    id: number;
    lineNum: number;
    level: number;
    title: string;
    isBold: boolean;
    isFolding: boolean;
    currentPeriodAmount: string;
    currentYearAmount: string;
  }>;
}

export function getIncomeStatement(
  accountSetId: number,
  year: number,
  month: number,
): Promise<IncomeStatement> {
  return requestData(
    `${accountSetPath(accountSetId)}/reports/income-statement?year=${year}&month=${month}`,
  );
}

export function getGeneralLedger(
  accountSetId: number,
  year: number,
  month: number,
): Promise<TrialBalance> {
  return requestData(
    `${accountSetPath(accountSetId)}/reports/general-ledger?year=${year}&month=${month}`,
  );
}

export interface SubjectDetailReport {
  period: { year: number; month: number };
  subject: Subject;
  beginning: { direction: "debit" | "credit" | "balanced"; balance: string };
  lines: Array<{
    id: number;
    voucherDate: string;
    voucherWord: string;
    voucherNumber: number;
    lineNumber: number;
    summary: string;
    debitAmount: string;
    creditAmount: string;
    balanceDirection: "debit" | "credit" | "balanced";
    balance: string;
  }>;
  total: {
    debit: string;
    credit: string;
    endingDirection: "debit" | "credit" | "balanced";
    endingBalance: string;
  };
}

export function getSubjectDetail(
  accountSetId: number,
  subjectId: number,
  year: number,
  month: number,
): Promise<SubjectDetailReport> {
  return requestData(
    `${accountSetPath(accountSetId)}/reports/subject-detail?subjectId=${subjectId}&year=${year}&month=${month}`,
  );
}

export function getAccountingPeriods(accountSetId: number): Promise<{
  currentPeriod: string;
  periods: AccountingPeriod[];
}> {
  return requestData(`${accountSetPath(accountSetId)}/periods`);
}

export function closeAccountingPeriod(
  accountSetId: number,
  year: number,
  month: number,
): Promise<{ year: number; month: number; status: string }> {
  return requestData(
    `${accountSetPath(accountSetId)}/periods/${year}/${month}/close`,
    { method: "POST", body: "{}" },
  );
}

export function reopenAccountingPeriod(
  accountSetId: number,
  year: number,
  month: number,
): Promise<{ year: number; month: number; status: string }> {
  return requestData(
    `${accountSetPath(accountSetId)}/periods/${year}/${month}/reopen`,
    { method: "POST", body: "{}" },
  );
}
