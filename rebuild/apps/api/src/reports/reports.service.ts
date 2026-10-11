import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { sql } from "kysely";
import type { DecimalString } from "../database/schema.js";
import { DatabaseService } from "../database/database.service.js";
import { Amount } from "../shared/amount.js";
import enterpriseIncomeTemplate from "./templates/enterprise-income.json" with { type: "json" };
import smallEnterpriseIncomeTemplate from "./templates/small-enterprise-income.json" with { type: "json" };

type IncomeFormula = {
  calculation: string;
  subjectCode?: string;
  fromTag?: string;
  accessRules?: number;
};
type IncomeTemplateItem = {
  id: number;
  title: string;
  lineNum: number;
  level: number;
  sources: number;
  isBolder: boolean;
  isFolding: boolean;
  formulas: IncomeFormula[];
};
type IncomeTemplateDocument = { items: IncomeTemplateItem[] };
type Totals = {
  beginningDebit: Amount;
  beginningCredit: Amount;
  currentDebit: Amount;
  currentCredit: Amount;
  endingDebit: Amount;
  endingCredit: Amount;
};

@Injectable()
export class ReportsService {
  constructor(private readonly database: DatabaseService) {}

  async trialBalance(accountSetId: number, year: number, month: number) {
    if (!Number.isInteger(year) || year < 1 || month < 1 || month > 12) {
      throw new NotFoundException("会计期间无效");
    }
    const db = this.database.requireDatabase();
    const accountSet = await db
      .selectFrom("account_sets")
      .select("id")
      .where("id", "=", accountSetId)
      .executeTakeFirst();
    if (!accountSet) throw new NotFoundException("账套不存在");
    const period = await db
      .selectFrom("accounting_periods")
      .select("id")
      .where("account_set_id", "=", accountSetId)
      .where("year", "=", year)
      .where("month", "=", month)
      .executeTakeFirst();
    if (!period) throw new NotFoundException("会计期间不存在或尚未启用");

    const subjects = await db
      .selectFrom("subjects")
      .selectAll()
      .where("account_set_id", "=", accountSetId)
      .orderBy("code")
      .execute();
    const periodKey = year * 100 + month;
    const movements = await db
      .selectFrom("voucher_lines")
      .innerJoin("vouchers", "vouchers.id", "voucher_lines.voucher_id")
      .select([
        "voucher_lines.subject_id",
        sql<DecimalString>`COALESCE(SUM(CASE WHEN vouchers.period_year * 100 + vouchers.period_month < ${periodKey} THEN voucher_lines.debit_amount ELSE 0 END), 0)`.as(
          "prior_debit",
        ),
        sql<DecimalString>`COALESCE(SUM(CASE WHEN vouchers.period_year * 100 + vouchers.period_month < ${periodKey} THEN voucher_lines.credit_amount ELSE 0 END), 0)`.as(
          "prior_credit",
        ),
        sql<DecimalString>`COALESCE(SUM(CASE WHEN vouchers.period_year = ${year} AND vouchers.period_month = ${month} THEN voucher_lines.debit_amount ELSE 0 END), 0)`.as(
          "current_debit",
        ),
        sql<DecimalString>`COALESCE(SUM(CASE WHEN vouchers.period_year = ${year} AND vouchers.period_month = ${month} THEN voucher_lines.credit_amount ELSE 0 END), 0)`.as(
          "current_credit",
        ),
      ])
      .where("voucher_lines.account_set_id", "=", accountSetId)
      .where("vouchers.status", "=", "posted")
      .where((eb) =>
        eb.or([
          eb("vouchers.period_year", "<", year),
          eb.and([
            eb("vouchers.period_year", "=", year),
            eb("vouchers.period_month", "<=", month),
          ]),
        ]),
      )
      .groupBy("voucher_lines.subject_id")
      .execute();
    const movementMap = new Map(movements.map((row) => [row.subject_id, row]));
    const totals = new Map<number, Totals>();
    const rows = new Map<
      number,
      {
        id: number;
        code: string;
        name: string;
        subject_type: string;
        parent_id: number | null;
        balance_direction: string;
        is_enabled: boolean;
        has_children: boolean;
      }
    >();
    const children = new Set<number>();

    for (const subject of subjects) {
      if (subject.parent_id !== null) children.add(subject.parent_id);
      rows.set(subject.id, {
        id: subject.id,
        code: subject.code,
        name: subject.name,
        subject_type: subject.subject_type,
        parent_id: subject.parent_id,
        balance_direction: subject.balance_direction,
        is_enabled: subject.is_enabled,
        has_children: false,
      });
      const movement = movementMap.get(subject.id);
      const beginningNet = Amount.from(subject.opening_debit)
        .subtract(Amount.from(subject.opening_credit))
        .add(Amount.from(movement?.prior_debit ?? "0"))
        .subtract(Amount.from(movement?.prior_credit ?? "0"));
      const currentDebit = Amount.from(movement?.current_debit ?? "0");
      const currentCredit = Amount.from(movement?.current_credit ?? "0");
      const endingNet = beginningNet.add(currentDebit).subtract(currentCredit);
      totals.set(subject.id, {
        beginningDebit: this.positivePart(beginningNet),
        beginningCredit: this.negativePart(beginningNet),
        currentDebit,
        currentCredit,
        endingDebit: this.positivePart(endingNet),
        endingCredit: this.negativePart(endingNet),
      });
    }

    for (const id of children) {
      const row = rows.get(id);
      if (row) row.has_children = true;
    }
    const subjectById = new Map(
      subjects.map((subject) => [subject.id, subject]),
    );
    const depth = (subjectId: number): number => {
      let current = subjectById.get(subjectId);
      let value = 0;
      while (current?.parent_id !== null && current?.parent_id !== undefined) {
        value++;
        current = subjectById.get(current.parent_id);
      }
      return value;
    };
    const deepestFirst = [...subjects].sort(
      (left, right) => depth(right.id) - depth(left.id),
    );
    for (const subject of deepestFirst) {
      if (subject.parent_id === null) continue;
      const parent = totals.get(subject.parent_id);
      const child = totals.get(subject.id);
      if (!parent || !child) continue;
      parent.beginningDebit = parent.beginningDebit.add(child.beginningDebit);
      parent.beginningCredit = parent.beginningCredit.add(
        child.beginningCredit,
      );
      parent.currentDebit = parent.currentDebit.add(child.currentDebit);
      parent.currentCredit = parent.currentCredit.add(child.currentCredit);
      parent.endingDebit = parent.endingDebit.add(child.endingDebit);
      parent.endingCredit = parent.endingCredit.add(child.endingCredit);
    }

    const lines = subjects.map((subject) => {
      const amounts = totals.get(subject.id)!;
      const row = rows.get(subject.id)!;
      return {
        ...row,
        beginningDebit: amounts.beginningDebit.toString(),
        beginningCredit: amounts.beginningCredit.toString(),
        currentDebit: amounts.currentDebit.toString(),
        currentCredit: amounts.currentCredit.toString(),
        endingDebit: amounts.endingDebit.toString(),
        endingCredit: amounts.endingCredit.toString(),
      };
    });
    const total = subjects
      .filter((subject) => !children.has(subject.id))
      .reduce(
        (sum, subject) => {
          const value = totals.get(subject.id)!;
          return {
            beginningDebit: sum.beginningDebit.add(value.beginningDebit),
            beginningCredit: sum.beginningCredit.add(value.beginningCredit),
            currentDebit: sum.currentDebit.add(value.currentDebit),
            currentCredit: sum.currentCredit.add(value.currentCredit),
            endingDebit: sum.endingDebit.add(value.endingDebit),
            endingCredit: sum.endingCredit.add(value.endingCredit),
          };
        },
        {
          beginningDebit: Amount.from("0"),
          beginningCredit: Amount.from("0"),
          currentDebit: Amount.from("0"),
          currentCredit: Amount.from("0"),
          endingDebit: Amount.from("0"),
          endingCredit: Amount.from("0"),
        },
      );

    return {
      period: { year, month },
      lines,
      total: {
        beginningDebit: total.beginningDebit.toString(),
        beginningCredit: total.beginningCredit.toString(),
        currentDebit: total.currentDebit.toString(),
        currentCredit: total.currentCredit.toString(),
        endingDebit: total.endingDebit.toString(),
        endingCredit: total.endingCredit.toString(),
      },
    };
  }

  async incomeStatement(accountSetId: number, year: number, month: number) {
    if (!Number.isInteger(year) || year < 1 || month < 1 || month > 12) {
      throw new BadRequestException("会计期间无效");
    }
    const db = this.database.requireDatabase();
    const accountSet = await db
      .selectFrom("account_sets")
      .select(["id", "accounting_standard"])
      .where("id", "=", accountSetId)
      .executeTakeFirst();
    if (!accountSet) throw new NotFoundException("账套不存在");
    const period = await db
      .selectFrom("accounting_periods")
      .select("id")
      .where("account_set_id", "=", accountSetId)
      .where("year", "=", year)
      .where("month", "=", month)
      .executeTakeFirst();
    if (!period) throw new NotFoundException("会计期间不存在或尚未启用");

    const standard = accountSet.accounting_standard.toLowerCase();
    const templateDocument = (standard === "small_enterprise" ||
    standard === "0"
      ? smallEnterpriseIncomeTemplate
      : enterpriseIncomeTemplate) as unknown as IncomeTemplateDocument;
    const template = templateDocument.items;
    const subjects = await db
      .selectFrom("subjects")
      .select(["id", "code", "balance_direction"])
      .where("account_set_id", "=", accountSetId)
      .execute();
    const subjectByCode = new Map(
      subjects.map((subject) => [subject.code, subject]),
    );
    const movements = await db
      .selectFrom("voucher_lines")
      .innerJoin("vouchers", "vouchers.id", "voucher_lines.voucher_id")
      .select([
        "voucher_lines.subject_id",
        sql<DecimalString>`COALESCE(SUM(CASE WHEN vouchers.period_month = ${month} THEN voucher_lines.debit_amount ELSE 0 END), 0)`.as(
          "current_debit",
        ),
        sql<DecimalString>`COALESCE(SUM(CASE WHEN vouchers.period_month = ${month} THEN voucher_lines.credit_amount ELSE 0 END), 0)`.as(
          "current_credit",
        ),
        sql<DecimalString>`COALESCE(SUM(voucher_lines.debit_amount), 0)`.as(
          "year_debit",
        ),
        sql<DecimalString>`COALESCE(SUM(voucher_lines.credit_amount), 0)`.as(
          "year_credit",
        ),
      ])
      .where("voucher_lines.account_set_id", "=", accountSetId)
      .where("vouchers.status", "=", "posted")
      .where("vouchers.period_year", "=", year)
      .where("vouchers.period_month", "<=", month)
      .groupBy("voucher_lines.subject_id")
      .execute();
    const movementBySubject = new Map(
      movements.map((movement) => [movement.subject_id, movement]),
    );
    const valuesByItem = new Map<number, { current: Amount; year: Amount }>();
    const lines = template.map((item, index) => {
      let current = Amount.from("0");
      let yearToDate = Amount.from("0");
      if (item.sources === 0) {
        for (const formula of item.formulas ?? []) {
          const subject = formula.subjectCode
            ? subjectByCode.get(formula.subjectCode)
            : undefined;
          if (!subject) continue;
          const movement = movementBySubject.get(subject.id);
          if (!movement) continue;
          const currentValue = this.incomeFormulaValue(
            formula.accessRules ?? 0,
            subject.balance_direction,
            movement.current_debit,
            movement.current_credit,
          );
          const yearValue = this.incomeFormulaValue(
            formula.accessRules ?? 0,
            subject.balance_direction,
            movement.year_debit,
            movement.year_credit,
          );
          if (formula.calculation === "-") {
            current = current.subtract(currentValue);
            yearToDate = yearToDate.subtract(yearValue);
          } else {
            current = current.add(currentValue);
            yearToDate = yearToDate.add(yearValue);
          }
        }
      } else if (item.sources === 1) {
        for (const formula of item.formulas ?? []) {
          let sourceId = Number(formula.fromTag);
          if (sourceId === item.id || !valuesByItem.has(sourceId)) {
            const previousTotal = [...template.slice(0, index)]
              .reverse()
              .find(
                (previous) =>
                  previous.level === 1 && valuesByItem.has(previous.id),
              );
            if (previousTotal) sourceId = previousTotal.id;
          }
          const source = valuesByItem.get(sourceId);
          if (!source) continue;
          if (formula.calculation === "-") {
            current = current.subtract(source.current);
            yearToDate = yearToDate.subtract(source.year);
          } else {
            current = current.add(source.current);
            yearToDate = yearToDate.add(source.year);
          }
        }
      }
      valuesByItem.set(item.id, { current, year: yearToDate });
      return {
        id: item.id,
        lineNum: item.lineNum,
        level: item.level,
        title: item.title.trim(),
        isBold: item.isBolder,
        isFolding: item.isFolding,
        currentPeriodAmount: current.toString(),
        currentYearAmount: yearToDate.toString(),
      };
    });
    return { period: { year, month }, name: "利润表", lines };
  }

  async balanceSheet(accountSetId: number, year: number, month: number) {
    const trialBalance = await this.trialBalance(accountSetId, year, month);
    const incomeStatement = await this.incomeStatement(
      accountSetId,
      year,
      month,
    );
    const assets: Array<{ code: string; name: string; amount: string }> = [];
    const liabilities: Array<{ code: string; name: string; amount: string }> =
      [];
    const equity: Array<{ code: string; name: string; amount: string }> = [];
    const other: Array<{
      code: string;
      name: string;
      amount: string;
      side: "assets" | "liabilities";
    }> = [];
    let assetTotal = Amount.from("0");
    let liabilityTotal = Amount.from("0");
    let equityTotal = Amount.from("0");
    let otherDebit = Amount.from("0");
    let otherCredit = Amount.from("0");

    for (const line of trialBalance.lines) {
      if (line.has_children) continue;
      const debit = Amount.from(line.endingDebit);
      const credit = Amount.from(line.endingCredit);
      let amount: Amount;
      if (line.subject_type === "资产" || line.subject_type === "成本") {
        amount = debit.subtract(credit);
        assetTotal = assetTotal.add(amount);
        if (amount.compare(Amount.from("0")) !== 0) {
          assets.push({
            code: line.code,
            name: line.name,
            amount: amount.toString(),
          });
        }
      } else if (line.subject_type === "负债") {
        amount = credit.subtract(debit);
        liabilityTotal = liabilityTotal.add(amount);
        if (amount.compare(Amount.from("0")) !== 0) {
          liabilities.push({
            code: line.code,
            name: line.name,
            amount: amount.toString(),
          });
        }
      } else if (line.subject_type === "所有者权益") {
        amount = credit.subtract(debit);
        equityTotal = equityTotal.add(amount);
        if (amount.compare(Amount.from("0")) !== 0) {
          equity.push({
            code: line.code,
            name: line.name,
            amount: amount.toString(),
          });
        }
      } else if (line.subject_type === "损益") {
        // Profit/loss accounts are represented by current-year net profit below.
        continue;
      } else {
        const direction = line.balance_direction;
        amount =
          direction === "debit"
            ? debit.subtract(credit)
            : credit.subtract(debit);
        if (direction === "debit") otherDebit = otherDebit.add(amount);
        else otherCredit = otherCredit.add(amount);
        if (amount.compare(Amount.from("0")) !== 0) {
          other.push({
            code: line.code,
            name: line.name,
            amount: amount.toString(),
            side: direction === "debit" ? "assets" : "liabilities",
          });
        }
      }
    }

    const netProfitLine = incomeStatement.lines.find((line) =>
      line.title.includes("净利润"),
    );
    const currentYearProfit = Amount.from(
      netProfitLine?.currentYearAmount ?? "0",
    );
    const totalAssets = assetTotal.add(otherDebit);
    const totalLiabilitiesAndEquity = liabilityTotal
      .add(equityTotal)
      .add(currentYearProfit)
      .add(otherCredit);
    const difference = totalAssets.subtract(totalLiabilitiesAndEquity);
    return {
      period: { year, month },
      basis: "按科目类别汇总；本年净利润作为未结转权益，尚非旧版行项目映射报表",
      assets,
      liabilities,
      equity,
      other,
      currentYearProfit: currentYearProfit.toString(),
      totals: {
        assets: totalAssets.toString(),
        liabilities: liabilityTotal.add(otherCredit).toString(),
        equity: equityTotal.add(currentYearProfit).toString(),
        liabilitiesAndEquity: totalLiabilitiesAndEquity.toString(),
        difference: difference.toString(),
        balanced: difference.compare(Amount.from("0")) === 0,
      },
    };
  }

  private incomeFormulaValue(
    accessRule: number,
    balanceDirection: string,
    debit: string,
    credit: string,
  ): Amount {
    const debitAmount = Amount.from(debit);
    const creditAmount = Amount.from(credit);
    switch (accessRule) {
      case 1:
        return debitAmount;
      case 2:
        return creditAmount;
      case 4:
        return debitAmount.subtract(creditAmount);
      case 5:
        return creditAmount.subtract(debitAmount);
      case 0:
      case 3:
      default:
        return balanceDirection === "debit"
          ? debitAmount.subtract(creditAmount)
          : creditAmount.subtract(debitAmount);
    }
  }

  async generalLedger(accountSetId: number, year: number, month: number) {
    const report = await this.trialBalance(accountSetId, year, month);
    return {
      ...report,
      lines: report.lines.filter((line) => !line.has_children),
    };
  }

  async subjectDetail(
    accountSetId: number,
    subjectId: number,
    year: number,
    month: number,
  ) {
    if (!Number.isInteger(year) || year < 1 || month < 1 || month > 12) {
      throw new BadRequestException("会计期间无效");
    }
    const db = this.database.requireDatabase();
    const subject = await db
      .selectFrom("subjects")
      .selectAll()
      .where("account_set_id", "=", accountSetId)
      .where("id", "=", subjectId)
      .executeTakeFirst();
    if (!subject) throw new NotFoundException("科目不存在");
    const child = await db
      .selectFrom("subjects")
      .select("id")
      .where("account_set_id", "=", accountSetId)
      .where("parent_id", "=", subjectId)
      .executeTakeFirst();
    if (child) throw new BadRequestException("明细账须选择末级科目");
    const period = await db
      .selectFrom("accounting_periods")
      .select("id")
      .where("account_set_id", "=", accountSetId)
      .where("year", "=", year)
      .where("month", "=", month)
      .executeTakeFirst();
    if (!period) throw new NotFoundException("会计期间不存在或尚未启用");

    const periodKey = year * 100 + month;
    const prior = await db
      .selectFrom("voucher_lines")
      .innerJoin("vouchers", "vouchers.id", "voucher_lines.voucher_id")
      .select([
        sql<DecimalString>`COALESCE(SUM(voucher_lines.debit_amount), 0)`.as(
          "debit",
        ),
        sql<DecimalString>`COALESCE(SUM(voucher_lines.credit_amount), 0)`.as(
          "credit",
        ),
      ])
      .where("voucher_lines.account_set_id", "=", accountSetId)
      .where("voucher_lines.subject_id", "=", subjectId)
      .where("vouchers.status", "=", "posted")
      .where((eb) =>
        eb.or([
          eb("vouchers.period_year", "<", year),
          eb.and([
            eb("vouchers.period_year", "=", year),
            eb("vouchers.period_month", "<", month),
          ]),
        ]),
      )
      .executeTakeFirstOrThrow();
    const sourceLines = await db
      .selectFrom("voucher_lines")
      .innerJoin("vouchers", "vouchers.id", "voucher_lines.voucher_id")
      .select([
        "voucher_lines.id as id",
        "voucher_lines.line_number as line_number",
        "voucher_lines.summary as summary",
        "voucher_lines.debit_amount as debit_amount",
        "voucher_lines.credit_amount as credit_amount",
        "vouchers.voucher_date as voucher_date",
        "vouchers.voucher_word as voucher_word",
        "vouchers.voucher_number as voucher_number",
      ])
      .where("voucher_lines.account_set_id", "=", accountSetId)
      .where("voucher_lines.subject_id", "=", subjectId)
      .where("vouchers.status", "=", "posted")
      .where("vouchers.period_year", "=", year)
      .where("vouchers.period_month", "=", month)
      .orderBy("vouchers.voucher_date")
      .orderBy("vouchers.voucher_word")
      .orderBy("vouchers.voucher_number")
      .orderBy("voucher_lines.line_number")
      .execute();

    const beginningNet = Amount.from(subject.opening_debit)
      .subtract(Amount.from(subject.opening_credit))
      .add(Amount.from(prior.debit))
      .subtract(Amount.from(prior.credit));
    let running = beginningNet;
    let currentDebit = Amount.from("0");
    let currentCredit = Amount.from("0");
    const lines = sourceLines.map((line) => {
      const debit = Amount.from(line.debit_amount);
      const credit = Amount.from(line.credit_amount);
      currentDebit = currentDebit.add(debit);
      currentCredit = currentCredit.add(credit);
      running = running.add(debit).subtract(credit);
      return {
        id: line.id,
        voucherDate: line.voucher_date,
        voucherWord: line.voucher_word,
        voucherNumber: line.voucher_number,
        lineNumber: line.line_number,
        summary: line.summary,
        debitAmount: debit.toString(),
        creditAmount: credit.toString(),
        balanceDirection:
          running.compare(Amount.from("0")) > 0
            ? "debit"
            : running.compare(Amount.from("0")) < 0
              ? "credit"
              : "balanced",
        balance: this.absolute(running).toString(),
      };
    });
    return {
      period: { year, month },
      subject,
      beginning: {
        direction:
          beginningNet.compare(Amount.from("0")) > 0
            ? "debit"
            : beginningNet.compare(Amount.from("0")) < 0
              ? "credit"
              : "balanced",
        balance: this.absolute(beginningNet).toString(),
      },
      lines,
      total: {
        debit: currentDebit.toString(),
        credit: currentCredit.toString(),
        endingDirection:
          running.compare(Amount.from("0")) > 0
            ? "debit"
            : running.compare(Amount.from("0")) < 0
              ? "credit"
              : "balanced",
        endingBalance: this.absolute(running).toString(),
      },
    };
  }

  private absolute(value: Amount): Amount {
    return value.compare(Amount.from("0")) < 0
      ? Amount.from("0").subtract(value)
      : value;
  }

  private positivePart(value: Amount): Amount {
    return value.compare(Amount.from("0")) > 0 ? value : Amount.from("0");
  }

  private negativePart(value: Amount): Amount {
    return value.compare(Amount.from("0")) < 0
      ? Amount.from("0").subtract(value)
      : Amount.from("0");
  }
}
