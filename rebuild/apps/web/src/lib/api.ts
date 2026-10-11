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
