import { z } from "zod";
import { Amount } from "../shared/amount.js";

const decimalAmount = z
  .string()
  .max(32)
  .regex(/^\d+(?:\.\d{1,8})?$/, "金额须为非负十进制字符串，最多 8 位小数");

const subjectType = z.enum([
  "资产",
  "负债",
  "共同",
  "所有者权益",
  "成本",
  "损益",
  "其他",
]);

export const createSubjectSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .regex(/^[\w.-]+$/),
    name: z.string().trim().min(1).max(160),
    parentId: z.number().int().positive().nullable().default(null),
    balanceDirection: z.enum(["debit", "credit"]),
    subjectType: subjectType.default("资产"),
    openingDebit: decimalAmount.default("0"),
    openingCredit: decimalAmount.default("0"),
  })
  .refine(
    (value) =>
      Amount.from(value.openingDebit).compare(Amount.from("0")) === 0 ||
      Amount.from(value.openingCredit).compare(Amount.from("0")) === 0,
    { message: "期初借方和贷方不能同时有余额" },
  );

export const updateSubjectSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    isEnabled: z.boolean().optional(),
  })
  .refine(
    (value) => value.name !== undefined || value.isEnabled !== undefined,
    {
      message: "至少提供一个要更新的字段",
    },
  );

export const updateOpeningBalanceSchema = z
  .object({
    debit: decimalAmount,
    credit: decimalAmount,
  })
  .refine(
    (value) =>
      Amount.from(value.debit).compare(Amount.from("0")) === 0 ||
      Amount.from(value.credit).compare(Amount.from("0")) === 0,
    { message: "期初借方和贷方不能同时有余额" },
  );

export type CreateSubject = z.infer<typeof createSubjectSchema>;
export type UpdateSubject = z.infer<typeof updateSubjectSchema>;
export type UpdateOpeningBalance = z.infer<typeof updateOpeningBalanceSchema>;
