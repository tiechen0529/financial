import { describe, expect, it } from "vitest";
import { createAccountSetSchema } from "./account-set.dto.js";

const validAccountSet = {
  companyName: "示例公司",
  accountingStandard: "enterprise",
  enabledFrom: "2026-01-01",
  currentPeriod: "2026-10-31",
};

describe("createAccountSetSchema", () => {
  it("normalizes currency and validates calendar dates", () => {
    expect(createAccountSetSchema.parse(validAccountSet)).toMatchObject({
      companyName: "示例公司",
      baseCurrency: "CNY",
    });
    expect(() =>
      createAccountSetSchema.parse({
        ...validAccountSet,
        currentPeriod: "2026-02-30",
      }),
    ).toThrow();
  });

  it("rejects a current period earlier than the enabled date", () => {
    expect(() =>
      createAccountSetSchema.parse({
        ...validAccountSet,
        enabledFrom: "2026-10-01",
        currentPeriod: "2026-09-30",
      }),
    ).toThrow();
  });
});
