import { describe, expect, it, vi } from "vitest";
import {
  checkDatabaseReadiness,
  createAccountSet,
  getHealth,
  listAccountSets,
} from "./api";

describe("API client", () => {
  it("reads the versioned API health endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getHealth(fetcher)).resolves.toEqual({ status: "ok" });
    expect(fetcher).toHaveBeenCalledWith("/api/v1/health", {
      headers: { Accept: "application/json" },
    });
  });

  it("checks database readiness separately from API liveness", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "ready" }), { status: 200 }),
      );

    await expect(checkDatabaseReadiness(fetcher)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith("/api/v1/health/ready", {
      headers: { Accept: "application/json" },
    });
  });

  it("loads the account-set data envelope", async () => {
    const accountSets = [
      {
        id: 7,
        company_name: "示例公司",
        base_currency: "CNY",
        accounting_standard: "enterprise",
        enabled_from: "2026-01-01",
        current_period: "2026-10-01",
      },
    ];
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: accountSets }), { status: 200 }),
      );

    await expect(listAccountSets(fetcher)).resolves.toEqual(accountSets);
  });

  it("creates an account set with a JSON POST", async () => {
    const input = {
      companyName: "示例公司",
      accountingStandard: "enterprise",
      enabledFrom: "2026-01-01",
      currentPeriod: "2026-10-01",
    };
    const created = {
      id: 7,
      company_name: "示例公司",
      base_currency: "CNY",
      accounting_standard: "enterprise",
      enabled_from: "2026-01-01",
      current_period: "2026-10-01",
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: created }), { status: 201 }),
      );

    await expect(createAccountSet(input, fetcher)).resolves.toEqual(created);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/account-sets",
      expect.objectContaining({ method: "POST", body: JSON.stringify(input) }),
    );
  });

  it("fails clearly when the API cannot be reached", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    await expect(getHealth(fetcher)).rejects.toThrow(
      "API health check failed (503)",
    );
  });
});
