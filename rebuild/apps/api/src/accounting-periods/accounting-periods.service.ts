import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { sql } from "kysely";
import type { DecimalString, FinancialDatabase } from "../database/schema.js";
import { DatabaseService } from "../database/database.service.js";
import { Amount } from "../shared/amount.js";

@Injectable()
export class AccountingPeriodsService {
  constructor(private readonly database: DatabaseService) {}

  async list(accountSetId: number) {
    const db = this.database.requireDatabase();
    const accountSet = await db
      .selectFrom("account_sets")
      .select(["id", "current_period"])
      .where("id", "=", accountSetId)
      .executeTakeFirst();
    if (!accountSet) throw new NotFoundException("账套不存在");
    const periods = await db
      .selectFrom("accounting_periods")
      .selectAll()
      .where("account_set_id", "=", accountSetId)
      .orderBy("year", "desc")
      .orderBy("month", "desc")
      .execute();
    return {
      currentPeriod: accountSet.current_period,
      periods,
    };
  }

  async close(accountSetId: number, year: number, month: number) {
    const db = this.database.requireDatabase();
    return db.transaction().execute(async (trx) => {
      const accountSet = await trx
        .selectFrom("account_sets")
        .select(["id", "current_period"])
        .where("id", "=", accountSetId)
        .forUpdate()
        .executeTakeFirst();
      if (!accountSet) throw new NotFoundException("账套不存在");
      if (
        accountSet.current_period.slice(0, 7) !==
        `${year}-${String(month).padStart(2, "0")}`
      ) {
        throw new ConflictException("只能结账当前会计期间");
      }

      const period = await trx
        .selectFrom("accounting_periods")
        .selectAll()
        .where("account_set_id", "=", accountSetId)
        .where("year", "=", year)
        .where("month", "=", month)
        .forUpdate()
        .executeTakeFirst();
      if (!period) throw new NotFoundException("会计期间不存在");
      if (period.status !== "open") {
        throw new ConflictException("该会计期间已经关闭");
      }
      const draft = await trx
        .selectFrom("vouchers")
        .select("id")
        .where("account_set_id", "=", accountSetId)
        .where("period_year", "=", year)
        .where("period_month", "=", month)
        .where("status", "=", "draft")
        .executeTakeFirst();
      if (draft) throw new ConflictException("本期仍有未记账凭证，不能结账");

      const opening = await trx
        .selectFrom("subjects")
        .select([
          sql<DecimalString>`COALESCE(SUM(opening_debit), 0)`.as("debit"),
          sql<DecimalString>`COALESCE(SUM(opening_credit), 0)`.as("credit"),
        ])
        .where("account_set_id", "=", accountSetId)
        .executeTakeFirstOrThrow();
      const posted = await trx
        .selectFrom("vouchers")
        .select([
          sql<DecimalString>`COALESCE(SUM(debit_total), 0)`.as("debit"),
          sql<DecimalString>`COALESCE(SUM(credit_total), 0)`.as("credit"),
        ])
        .where("account_set_id", "=", accountSetId)
        .where("status", "=", "posted")
        .where((eb) =>
          eb.or([
            eb("period_year", "<", year),
            eb.and([
              eb("period_year", "=", year),
              eb("period_month", "<=", month),
            ]),
          ]),
        )
        .executeTakeFirstOrThrow();
      const totalDebit = Amount.from(opening.debit).add(
        Amount.from(posted.debit),
      );
      const totalCredit = Amount.from(opening.credit).add(
        Amount.from(posted.credit),
      );
      if (totalDebit.compare(totalCredit) !== 0) {
        throw new ConflictException(
          "期末试算不平衡：请检查科目期初余额和已记账凭证",
        );
      }

      const next = this.nextPeriod(year, month);
      const existingNext = await trx
        .selectFrom("accounting_periods")
        .select(["status"])
        .where("account_set_id", "=", accountSetId)
        .where("year", "=", next.year)
        .where("month", "=", next.month)
        .forUpdate()
        .executeTakeFirst();
      if (existingNext?.status === "closed") {
        throw new ConflictException("下一期间已关闭，请检查结账顺序");
      }
      if (!existingNext) {
        await trx
          .insertInto("accounting_periods")
          .values({
            account_set_id: accountSetId,
            year: next.year,
            month: next.month,
            status: "open",
          })
          .execute();
      }
      await trx
        .updateTable("accounting_periods")
        .set({ status: "closed", closed_at: new Date() })
        .where("account_set_id", "=", accountSetId)
        .where("year", "=", year)
        .where("month", "=", month)
        .execute();
      await trx
        .updateTable("account_sets")
        .set({
          current_period: `${next.year}-${String(next.month).padStart(2, "0")}-01`,
        })
        .where("id", "=", accountSetId)
        .execute();
      return { year, month, status: "closed", nextPeriod: next };
    });
  }

  async reopen(accountSetId: number, year: number, month: number) {
    const db = this.database.requireDatabase();
    return db.transaction().execute(async (trx) => {
      const accountSet = await trx
        .selectFrom("account_sets")
        .select(["id", "current_period"])
        .where("id", "=", accountSetId)
        .forUpdate()
        .executeTakeFirst();
      if (!accountSet) throw new NotFoundException("账套不存在");
      const next = this.nextPeriod(year, month);
      if (
        accountSet.current_period.slice(0, 7) !==
        `${next.year}-${String(next.month).padStart(2, "0")}`
      ) {
        throw new ConflictException("只能反结账最近一个已关闭期间");
      }
      const period = await trx
        .selectFrom("accounting_periods")
        .select(["status"])
        .where("account_set_id", "=", accountSetId)
        .where("year", "=", year)
        .where("month", "=", month)
        .forUpdate()
        .executeTakeFirst();
      if (!period || period.status !== "closed") {
        throw new ConflictException("该期间并未关闭");
      }
      const nextVoucher = await trx
        .selectFrom("vouchers")
        .select("id")
        .where("account_set_id", "=", accountSetId)
        .where("period_year", "=", next.year)
        .where("period_month", "=", next.month)
        .executeTakeFirst();
      if (nextVoucher) {
        throw new ConflictException("下一期间已有凭证，不能反结账");
      }
      await trx
        .deleteFrom("accounting_periods")
        .where("account_set_id", "=", accountSetId)
        .where("year", "=", next.year)
        .where("month", "=", next.month)
        .where("status", "=", "open")
        .execute();
      await trx
        .updateTable("accounting_periods")
        .set({ status: "open", closed_at: null })
        .where("account_set_id", "=", accountSetId)
        .where("year", "=", year)
        .where("month", "=", month)
        .execute();
      await trx
        .updateTable("account_sets")
        .set({ current_period: `${year}-${String(month).padStart(2, "0")}-01` })
        .where("id", "=", accountSetId)
        .execute();
      return { year, month, status: "open" };
    });
  }

  private nextPeriod(year: number, month: number) {
    return month === 12
      ? { year: year + 1, month: 1 }
      : { year, month: month + 1 };
  }
}
