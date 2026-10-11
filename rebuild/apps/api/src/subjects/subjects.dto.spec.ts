import { describe, expect, it } from "vitest";
import {
  createSubjectSchema,
  updateOpeningBalanceSchema,
} from "./subjects.dto.js";

describe("subject accounting inputs", () => {
  it("accepts non-negative opening balances on one normal side", () => {
    expect(
      updateOpeningBalanceSchema.safeParse({ debit: "123.45", credit: "0" })
        .success,
    ).toBe(true);
    expect(
      updateOpeningBalanceSchema.safeParse({ debit: "0", credit: "0" }).success,
    ).toBe(true);
  });

  it("rejects simultaneous debit and credit opening balances", () => {
    expect(
      updateOpeningBalanceSchema.safeParse({ debit: "1", credit: "2" }).success,
    ).toBe(false);
  });

  it("rejects malformed codes and floating-point amounts", () => {
    const result = createSubjectSchema.safeParse({
      code: "1001 !",
      name: "库存现金",
      parentId: null,
      balanceDirection: "debit",
      subjectType: "资产",
      openingDebit: 0.1,
      openingCredit: "0",
    });
    expect(result.success).toBe(false);
  });
});
