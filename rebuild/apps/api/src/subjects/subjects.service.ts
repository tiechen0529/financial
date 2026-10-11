import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Insertable, Selectable, Transaction } from "kysely";
import enterpriseTemplate from "./templates/enterprise.json" with { type: "json" };
import smallEnterpriseTemplate from "./templates/small_enterprise.json" with { type: "json" };
import type { FinancialDatabase, SubjectsTable } from "../database/schema.js";
import { DatabaseService } from "../database/database.service.js";
import { Amount } from "../shared/amount.js";
import type {
  CreateSubject,
  UpdateOpeningBalance,
  UpdateSubject,
} from "./subjects.dto.js";

type Subject = Selectable<SubjectsTable>;
type SubjectTemplate = {
  code: string;
  name: string;
  type?: string;
  balance_direction: string;
  children?: SubjectTemplate[];
};

@Injectable()
export class SubjectsService {
  constructor(private readonly database: DatabaseService) {}

  async list(accountSetId: number): Promise<Subject[]> {
    const db = this.database.requireDatabase();
    await this.requireAccountSet(db, accountSetId);
    return db
      .selectFrom("subjects")
      .selectAll()
      .where("account_set_id", "=", accountSetId)
      .orderBy("code")
      .execute();
  }

  async initialize(accountSetId: number): Promise<{ inserted: number }> {
    const db = this.database.requireDatabase();
    return db.transaction().execute(async (trx) => {
      const accountSet = await trx
        .selectFrom("account_sets")
        .select(["id", "accounting_standard"])
        .where("id", "=", accountSetId)
        .forUpdate()
        .executeTakeFirst();
      if (!accountSet) throw new NotFoundException("账套不存在");

      const existing = await trx
        .selectFrom("subjects")
        .select(({ fn }) => fn.countAll<number>().as("count"))
        .where("account_set_id", "=", accountSetId)
        .executeTakeFirstOrThrow();
      if (Number(existing.count) > 0) {
        throw new ConflictException("该账套已有科目，不能重复初始化模板");
      }

      const standard = accountSet.accounting_standard.toLowerCase();
      const templateName =
        standard === "small_enterprise" || standard === "0"
          ? "small_enterprise"
          : "enterprise";
      const template = (
        templateName === "small_enterprise"
          ? smallEnterpriseTemplate
          : enterpriseTemplate
      ) as SubjectTemplate[];
      const inserted = await this.insertTemplate(trx, accountSetId, template);
      return { inserted };
    });
  }

  async create(accountSetId: number, input: CreateSubject): Promise<Subject> {
    const db = this.database.requireDatabase();
    await this.requireAccountSet(db, accountSetId);
    if (input.parentId !== null) {
      const parent = await this.requireSubject(
        db,
        accountSetId,
        input.parentId,
      );
      if (!parent.is_enabled) {
        throw new ConflictException("不能在已停用科目下新增下级科目");
      }
      if (parent.subject_type !== input.subjectType) {
        throw new BadRequestException("下级科目类别须与上级科目一致");
      }
    }
    const duplicate = await db
      .selectFrom("subjects")
      .select("id")
      .where("account_set_id", "=", accountSetId)
      .where("code", "=", input.code)
      .executeTakeFirst();
    if (duplicate) throw new ConflictException("该科目编码已存在");

    const result = await db
      .insertInto("subjects")
      .values({
        account_set_id: accountSetId,
        code: input.code,
        name: input.name,
        parent_id: input.parentId,
        balance_direction: input.balanceDirection,
        subject_type: input.subjectType,
        opening_debit: input.openingDebit,
        opening_credit: input.openingCredit,
      })
      .executeTakeFirstOrThrow();
    return this.requireSubject(db, accountSetId, Number(result.insertId));
  }

  async update(
    accountSetId: number,
    subjectId: number,
    input: UpdateSubject,
  ): Promise<Subject> {
    const db = this.database.requireDatabase();
    await this.requireSubject(db, accountSetId, subjectId);
    if (input.isEnabled === false) {
      const activeChildren = await db
        .selectFrom("subjects")
        .select("id")
        .where("account_set_id", "=", accountSetId)
        .where("parent_id", "=", subjectId)
        .where("is_enabled", "=", true)
        .executeTakeFirst();
      if (activeChildren) {
        throw new ConflictException("请先停用该科目的下级科目");
      }
    }
    await db
      .updateTable("subjects")
      .set({
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.isEnabled === undefined
          ? {}
          : { is_enabled: input.isEnabled }),
      })
      .where("account_set_id", "=", accountSetId)
      .where("id", "=", subjectId)
      .execute();
    return this.requireSubject(db, accountSetId, subjectId);
  }

  async updateOpeningBalance(
    accountSetId: number,
    subjectId: number,
    input: UpdateOpeningBalance,
  ): Promise<Subject> {
    const db = this.database.requireDatabase();
    const subject = await this.requireSubject(db, accountSetId, subjectId);
    const child = await db
      .selectFrom("subjects")
      .select("id")
      .where("account_set_id", "=", accountSetId)
      .where("parent_id", "=", subjectId)
      .executeTakeFirst();
    if (child) throw new ConflictException("期初余额只能设置在末级科目上");
    const used = await db
      .selectFrom("voucher_lines")
      .innerJoin("vouchers", "vouchers.id", "voucher_lines.voucher_id")
      .select("voucher_lines.id")
      .where("voucher_lines.account_set_id", "=", accountSetId)
      .where("voucher_lines.subject_id", "=", subjectId)
      .where("vouchers.status", "=", "posted")
      .executeTakeFirst();
    if (used) {
      throw new ConflictException("已有已记账凭证，不可再修改期初余额");
    }
    await db
      .updateTable("subjects")
      .set({ opening_debit: input.debit, opening_credit: input.credit })
      .where("account_set_id", "=", accountSetId)
      .where("id", "=", subjectId)
      .execute();
    return this.requireSubject(db, accountSetId, subjectId);
  }

  async remove(accountSetId: number, subjectId: number): Promise<void> {
    const db = this.database.requireDatabase();
    const subject = await this.requireSubject(db, accountSetId, subjectId);
    if (
      Amount.from(subject.opening_debit).compare(Amount.from("0")) > 0 ||
      Amount.from(subject.opening_credit).compare(Amount.from("0")) > 0
    ) {
      throw new ConflictException("科目存在期初余额，不能删除");
    }
    const child = await db
      .selectFrom("subjects")
      .select("id")
      .where("account_set_id", "=", accountSetId)
      .where("parent_id", "=", subjectId)
      .executeTakeFirst();
    if (child) throw new ConflictException("请先删除该科目的下级科目");
    const voucherLine = await db
      .selectFrom("voucher_lines")
      .select("id")
      .where("account_set_id", "=", accountSetId)
      .where("subject_id", "=", subjectId)
      .executeTakeFirst();
    if (voucherLine)
      throw new ConflictException("已有凭证使用该科目，不能删除");
    await db
      .deleteFrom("subjects")
      .where("account_set_id", "=", accountSetId)
      .where("id", "=", subjectId)
      .execute();
  }

  private async insertTemplate(
    trx: Transaction<FinancialDatabase>,
    accountSetId: number,
    nodes: SubjectTemplate[],
    parentId: number | null = null,
  ): Promise<number> {
    let inserted = 0;
    for (const node of nodes) {
      const values: Insertable<SubjectsTable> = {
        account_set_id: accountSetId,
        code: node.code,
        name: node.name,
        parent_id: parentId,
        balance_direction: node.balance_direction === "贷" ? "credit" : "debit",
        subject_type: node.type ?? "资产",
      };
      const result = await trx
        .insertInto("subjects")
        .values(values)
        .executeTakeFirstOrThrow();
      const id = Number(result.insertId);
      inserted++;
      if (node.children?.length) {
        inserted += await this.insertTemplate(
          trx,
          accountSetId,
          node.children,
          id,
        );
      }
    }
    return inserted;
  }

  private async requireAccountSet(
    db: ReturnType<DatabaseService["requireDatabase"]>,
    accountSetId: number,
  ): Promise<void> {
    const row = await db
      .selectFrom("account_sets")
      .select("id")
      .where("id", "=", accountSetId)
      .executeTakeFirst();
    if (!row) throw new NotFoundException("账套不存在");
  }

  private async requireSubject(
    db: ReturnType<DatabaseService["requireDatabase"]>,
    accountSetId: number,
    subjectId: number,
  ): Promise<Subject> {
    const row = await db
      .selectFrom("subjects")
      .selectAll()
      .where("account_set_id", "=", accountSetId)
      .where("id", "=", subjectId)
      .executeTakeFirst();
    if (!row) throw new NotFoundException("科目不存在");
    return row;
  }
}
