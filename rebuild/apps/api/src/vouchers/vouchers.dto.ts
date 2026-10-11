import { z } from "zod";
import { Amount } from "../shared/amount.js";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "日期须为有效的 YYYY-MM-DD 日期");

const amount = z
  .string()
  .max(32)
  .regex(/^\d+(?:\.\d{1,8})?$/, "金额须为非负十进制字符串，最多 8 位小数");

const voucherLine = z
  .object({
    subjectId: z.number().int().positive(),
    summary: z.string().trim().max(512).default(""),
    debitAmount: amount,
    creditAmount: amount,
  })
  .refine(
    (line) =>
      !(
        Amount.from(line.debitAmount).compare(Amount.from("0")) > 0 &&
        Amount.from(line.creditAmount).compare(Amount.from("0")) > 0
      ) &&
      (Amount.from(line.debitAmount).compare(Amount.from("0")) > 0 ||
        Amount.from(line.creditAmount).compare(Amount.from("0")) > 0),
    { message: "每条分录须且仅须填写一个正数借方或贷方金额" },
  );

export const voucherInputSchema = z.object({
  voucherDate: isoDate,
  voucherWord: z.string().trim().min(1).max(24).default("记"),
  lines: z.array(voucherLine).min(2).max(100),
});

export type VoucherInput = z.infer<typeof voucherInputSchema>;
