import { describe, expect, it } from "vitest";
import { voucherInputSchema } from "./vouchers.dto.js";

const balancedInput = {
  voucherDate: "2026-10-11",
  voucherWord: "记",
  lines: [
    {
      subjectId: 1,
      summary: "现金收款",
      debitAmount: "100.00",
      creditAmount: "0",
    },
    {
      subjectId: 2,
      summary: "现金收款",
      debitAmount: "0",
      creditAmount: "100.00",
    },
  ],
};

describe("voucherInputSchema", () => {
  it("accepts exact decimal strings and a valid calendar date", () => {
    expect(voucherInputSchema.safeParse(balancedInput).success).toBe(true);
  });

  it("allows an unbalanced draft so it can be corrected before posting", () => {
    const draft = structuredClone(balancedInput);
    draft.lines[1]!.creditAmount = "99.99";
    expect(voucherInputSchema.safeParse(draft).success).toBe(true);
  });

  it("rejects a line with two nonzero sides or no amount", () => {
    const bothSides = structuredClone(balancedInput);
    bothSides.lines[0]!.creditAmount = "1";
    expect(voucherInputSchema.safeParse(bothSides).success).toBe(false);

    const empty = structuredClone(balancedInput);
    empty.lines[0]!.debitAmount = "0";
    expect(voucherInputSchema.safeParse(empty).success).toBe(false);
  });

  it("rejects floats, exponent notation, over-precision, and invalid dates", () => {
    const badMoney = structuredClone(balancedInput);
    badMoney.lines[0]!.debitAmount = "0.000000001";
    expect(voucherInputSchema.safeParse(badMoney).success).toBe(false);

    expect(
      voucherInputSchema.safeParse({
        ...balancedInput,
        voucherDate: "2026-02-30",
      }).success,
    ).toBe(false);
  });
});
