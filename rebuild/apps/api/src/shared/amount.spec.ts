import { describe, expect, it } from "vitest";
import { Amount } from "./amount.js";

describe("Amount", () => {
  it("adds decimal values without binary floating-point drift", () => {
    expect(Amount.from("0.1").add(Amount.from("0.2")).toString()).toBe("0.3");
  });

  it("rounds only when a currency scale is explicitly requested", () => {
    expect(Amount.from("1.005").toFixed(2)).toBe("1.01");
    expect(Amount.from("1.005").toString()).toBe("1.005");
  });

  it("rejects JavaScript-number-like and malformed inputs", () => {
    expect(() => Amount.from("1e-7")).toThrow(TypeError);
    expect(() => Amount.from(0.1 as unknown as string)).toThrow(TypeError);
    expect(() => Amount.from("NaN")).toThrow(TypeError);
    expect(() => Amount.from("1.2.3")).toThrow(TypeError);
  });
});
