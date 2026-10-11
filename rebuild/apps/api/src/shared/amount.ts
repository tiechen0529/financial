import { Decimal } from "decimal.js";

const PreciseDecimal = Decimal.clone({ precision: 40 });
const DECIMAL_LITERAL = /^-?\d+(?:\.\d+)?$/;

/** Exact decimal arithmetic for financial values. Inputs are strings to reject JS floats. */
export class Amount {
  private constructor(private readonly value: Decimal) {}

  static from(input: string): Amount {
    if (
      typeof input !== "string" ||
      input.length > 40 ||
      !DECIMAL_LITERAL.test(input)
    ) {
      throw new TypeError("Amount must be a finite base-10 decimal string");
    }
    return new Amount(new PreciseDecimal(input));
  }

  add(other: Amount): Amount {
    return new Amount(this.value.plus(other.value));
  }

  subtract(other: Amount): Amount {
    return new Amount(this.value.minus(other.value));
  }

  compare(other: Amount): -1 | 0 | 1 {
    return this.value.comparedTo(other.value) as -1 | 0 | 1;
  }

  toString(): string {
    return this.value.toFixed();
  }

  toFixed(scale: number): string {
    if (!Number.isInteger(scale) || scale < 0 || scale > 8) {
      throw new RangeError("Amount scale must be an integer from 0 to 8");
    }
    return this.value.toFixed(scale, PreciseDecimal.ROUND_HALF_UP);
  }
}
