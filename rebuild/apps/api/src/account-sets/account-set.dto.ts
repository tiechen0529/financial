import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Date must be a real calendar date in YYYY-MM-DD format");

export const createAccountSetSchema = z
  .object({
    companyName: z.string().trim().min(1).max(160),
    baseCurrency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/)
      .default("CNY"),
    accountingStandard: z.string().trim().min(1).max(40),
    enabledFrom: isoDate,
    currentPeriod: isoDate,
  })
  .refine((value) => value.currentPeriod >= value.enabledFrom, {
    message: "Current period cannot precede the enabled date",
    path: ["currentPeriod"],
  });

export type CreateAccountSet = z.infer<typeof createAccountSetSchema>;
