import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Insertable, Selectable, Transaction } from "kysely";
import { Amount } from "../shared/amount.js";
import type {
  FinancialDatabase,
  VoucherLinesTable,
  VouchersTable,
} from "../database/schema.js";
import { DatabaseService } from "../database/database.service.js";
import type { VoucherInput } from "./vouchers.dto.js";

type Voucher = Selectable<VouchersTable>;
type VoucherLine = Selectable<VoucherLinesTable>;
type VoucherWithLines = Voucher & { lines: VoucherLine[] };

@Injectable()
export class VouchersService {
  constructor(private readonly database: DatabaseService) {}

  async list(
    accountSetId: number,
    year?: string,
    month?: string,
  ): Promise<VoucherWithLines[]> {
    const db = this.database.requireDatabase();
    const accountSet = await db
      .selectFrom("account_sets")
      .select(["current_period"])
      .where("id", "=", accountSetId)
      .executeTakeFirst();
    if (!accountSet) throw new NotFoundException("账套不存在");

    const defaultYear = Number(accountSet.current_period.slice(0, 4));
    const defaultMonth = Number(accountSet.current_period.slice(5, 7));
    const selectedYear = this.parsePeriodValue(year, defaultYear, "年");
    const selectedMonth = this.parsePeriodValue(month, defaultMonth, "月");
    if (selectedMonth < 1 || selectedMonth > 12) {
      throw new BadRequestException("月份须在 1 到 12 之间");
    }

    const vouchers = await db
      .selectFrom("vouchers")
      .selectAll()
      .where("account_set_id", "=", accountSetId)
      .where("period_year", "=", selectedYear)
      .where("period_month", "=", selectedMonth)
      .orderBy("voucher_number")
      .execute();
    if (vouchers.length === 0) return [];

    const lines = await db
      .selectFrom("voucher_lines")
      .selectAll()
      .where("account_set_id", "=", accountSetId)
      .where(
        "voucher_id",
        "in",
        vouchers.map((voucher) => voucher.id),
      )
      .orderBy("line_number")
      .execute();
    const linesByVoucher = new Map<number, VoucherLine[]>();
    for (const line of lines) {
      const group = linesByVoucher.get(line.voucher_id) ?? [];
      group.push(line);
      linesByVoucher.set(line.voucher_id, group);
    }
    return vouchers.map((voucher) => ({
      ...voucher,
      lines: linesByVoucher.get(voucher.id) ?? [],
    }));
  }

  async get(
    accountSetId: number,
    voucherId: number,
  ): Promise<VoucherWithLines> {
    const db = this.database.requireDatabase();
    const voucher = await db
      .selectFrom("vouchers")
      .selectAll()
      .where("account_set_id", "=", accountSetId)
      .where("id", "=", voucherId)
      .executeTakeFirst();
    if (!voucher) throw new NotFoundException("凭证不存在");
    const lines = await db
      .selectFrom("voucher_lines")
      .selectAll()
      .where("account_set_id", "=", accountSetId)
      .where("voucher_id", "=", voucherId)
      .orderBy("line_number")
      .execute();
    return { ...voucher, lines };
  }

  async create(
    accountSetId: number,
    input: VoucherInput,
  ): Promise<VoucherWithLines> {
    const db = this.database.requireDatabase();
    const voucherId = await db.transaction().execute(async (trx) => {
      const period = this.periodFromDate(input.voucherDate);
      await this.lockOpenPeriod(trx, accountSetId, period.year, period.month);
      await this.requirePostableSubjects(
        trx,
        accountSetId,
        input.lines.map((line) => line.subjectId),
      );
      const totals = this.sumLines(input.lines);
      const lastVoucher = await trx
        .selectFrom("vouchers")
        .select(({ fn }) => fn.max("voucher_number").as("max_number"))
        .where("account_set_id", "=", accountSetId)
        .where("period_year", "=", period.year)
        .where("period_month", "=", period.month)
        .where("voucher_word", "=", input.voucherWord)
        .executeTakeFirst();
      const voucherNumber = Number(lastVoucher?.max_number ?? 0) + 1;
      const result = await trx
        .insertInto("vouchers")
        .values({
          account_set_id: accountSetId,
          voucher_date: input.voucherDate,
          period_year: period.year,
          period_month: period.month,
          voucher_word: input.voucherWord,
          voucher_number: voucherNumber,
          status: "draft",
          debit_total: totals.debit.toString(),
          credit_total: totals.credit.toString(),
        })
        .executeTakeFirstOrThrow();
      const id = Number(result.insertId);
      await this.replaceLines(trx, accountSetId, id, input.lines);
      return id;
    });
    return this.get(accountSetId, voucherId);
  }

  async updateDraft(
    accountSetId: number,
    voucherId: number,
    input: VoucherInput,
  ): Promise<VoucherWithLines> {
    const db = this.database.requireDatabase();
    await db.transaction().execute(async (trx) => {
      const voucher = await trx
        .selectFrom("vouchers")
        .selectAll()
        .where("account_set_id", "=", accountSetId)
        .where("id", "=", voucherId)
        .forUpdate()
        .executeTakeFirst();
      if (!voucher) throw new NotFoundException("凭证不存在");
      if (voucher.status !== "draft") {
        throw new ConflictException("只有未记账凭证可以修改");
      }
      const period = this.periodFromDate(input.voucherDate);
      if (
        period.year !== voucher.period_year ||
        period.month !== voucher.period_month
      ) {
        throw new BadRequestException("修改日期不能改变凭证所属期间");
      }
      await this.lockOpenPeriod(trx, accountSetId, period.year, period.month);
      await this.requirePostableSubjects(
        trx,
        accountSetId,
        input.lines.map((line) => line.subjectId),
      );
      const totals = this.sumLines(input.lines);
      await trx
        .updateTable("vouchers")
        .set({
          voucher_date: input.voucherDate,
          debit_total: totals.debit.toString(),
          credit_total: totals.credit.toString(),
        })
        .where("account_set_id", "=", accountSetId)
        .where("id", "=", voucherId)
        .execute();
      await trx
        .deleteFrom("voucher_lines")
        .where("account_set_id", "=", accountSetId)
        .where("voucher_id", "=", voucherId)
        .execute();
      await this.replaceLines(trx, accountSetId, voucherId, input.lines);
    });
    return this.get(accountSetId, voucherId);
  }

  async post(
    accountSetId: number,
    voucherId: number,
  ): Promise<VoucherWithLines> {
    const db = this.database.requireDatabase();
    await db.transaction().execute(async (trx) => {
      const voucher = await trx
        .selectFrom("vouchers")
        .selectAll()
        .where("account_set_id", "=", accountSetId)
        .where("id", "=", voucherId)
        .forUpdate()
        .executeTakeFirst();
      if (!voucher) throw new NotFoundException("凭证不存在");
      if (voucher.status !== "draft") {
        throw new ConflictException("只有未记账凭证可以记账");
      }
      await this.lockOpenPeriod(
        trx,
        accountSetId,
        voucher.period_year,
        voucher.period_month,
      );
      const lines = await trx
        .selectFrom("voucher_lines")
        .selectAll()
        .where("account_set_id", "=", accountSetId)
        .where("voucher_id", "=", voucherId)
        .orderBy("line_number")
        .execute();
      if (lines.length < 2) {
        throw new BadRequestException("凭证至少需要两条分录");
      }
      await this.requirePostableSubjects(
        trx,
        accountSetId,
        lines.map((line) => line.subject_id),
      );
      const totals = this.sumLines(
        lines.map((line) => ({
          debitAmount: line.debit_amount,
          creditAmount: line.credit_amount,
        })),
      );
      if (totals.debit.compare(Amount.from("0")) <= 0) {
        throw new BadRequestException("凭证借方金额必须大于零");
      }
      if (totals.debit.compare(totals.credit) !== 0) {
        throw new BadRequestException("凭证借贷不平，不能记账");
      }
      await trx
        .updateTable("vouchers")
        .set({
          status: "posted",
          debit_total: totals.debit.toString(),
          credit_total: totals.credit.toString(),
        })
        .where("account_set_id", "=", accountSetId)
        .where("id", "=", voucherId)
        .execute();
    });
    return this.get(accountSetId, voucherId);
  }

  async removeDraft(accountSetId: number, voucherId: number): Promise<void> {
    const db = this.database.requireDatabase();
    await db.transaction().execute(async (trx) => {
      const voucher = await trx
        .selectFrom("vouchers")
        .selectAll()
        .where("account_set_id", "=", accountSetId)
        .where("id", "=", voucherId)
        .forUpdate()
        .executeTakeFirst();
      if (!voucher) throw new NotFoundException("凭证不存在");
      if (voucher.status !== "draft") {
        throw new ConflictException("只有未记账凭证可以删除");
      }
      await this.lockOpenPeriod(
        trx,
        accountSetId,
        voucher.period_year,
        voucher.period_month,
      );
      await trx
        .deleteFrom("vouchers")
        .where("account_set_id", "=", accountSetId)
        .where("id", "=", voucherId)
        .execute();
    });
  }

  private async lockOpenPeriod(
    trx: Transaction<FinancialDatabase>,
    accountSetId: number,
    year: number,
    month: number,
  ): Promise<void> {
    const period = await trx
      .selectFrom("accounting_periods")
      .select(["status"])
      .where("account_set_id", "=", accountSetId)
      .where("year", "=", year)
      .where("month", "=", month)
      .forUpdate()
      .executeTakeFirst();
    if (!period) throw new ConflictException("会计期间不存在或尚未启用");
    if (period.status !== "open") {
      throw new ConflictException("该会计期间已关闭，不能修改凭证");
    }
  }

  private async requirePostableSubjects(
    trx: Transaction<FinancialDatabase>,
    accountSetId: number,
    subjectIds: number[],
  ): Promise<void> {
    const uniqueIds = [...new Set(subjectIds)];
    const subjects = await trx
      .selectFrom("subjects")
      .select(["id", "is_enabled"])
      .where("account_set_id", "=", accountSetId)
      .where("id", "in", uniqueIds)
      .execute();
    if (subjects.length !== uniqueIds.length) {
      throw new BadRequestException("分录包含不属于当前账套的科目");
    }
    if (subjects.some((subject) => !subject.is_enabled)) {
      throw new BadRequestException("分录包含已停用科目");
    }
    const parent = await trx
      .selectFrom("subjects")
      .select("parent_id")
      .where("account_set_id", "=", accountSetId)
      .where("is_enabled", "=", true)
      .where("parent_id", "in", uniqueIds)
      .executeTakeFirst();
    if (parent) throw new BadRequestException("凭证只能使用末级科目");
  }

  private async replaceLines(
    trx: Transaction<FinancialDatabase>,
    accountSetId: number,
    voucherId: number,
    lines: VoucherInput["lines"],
  ): Promise<void> {
    const values: Insertable<VoucherLinesTable>[] = lines.map(
      (line, index) => ({
        account_set_id: accountSetId,
        voucher_id: voucherId,
        line_number: index + 1,
        subject_id: line.subjectId,
        summary: line.summary,
        debit_amount: Amount.from(line.debitAmount).toString(),
        credit_amount: Amount.from(line.creditAmount).toString(),
      }),
    );
    await trx.insertInto("voucher_lines").values(values).execute();
  }

  private sumLines(
    lines: Array<{ debitAmount: string; creditAmount: string }>,
  ): { debit: Amount; credit: Amount } {
    return lines.reduce(
      (sum, line) => ({
        debit: sum.debit.add(Amount.from(line.debitAmount)),
        credit: sum.credit.add(Amount.from(line.creditAmount)),
      }),
      { debit: Amount.from("0"), credit: Amount.from("0") },
    );
  }

  private periodFromDate(date: string): { year: number; month: number } {
    return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
  }

  private parsePeriodValue(
    value: string | undefined,
    fallback: number,
    label: string,
  ): number {
    if (value === undefined) return fallback;
    if (!/^\d{1,4}$/.test(value)) {
      throw new BadRequestException(`期间${label}无效`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      throw new BadRequestException(`期间${label}无效`);
    }
    return parsed;
  }
}
