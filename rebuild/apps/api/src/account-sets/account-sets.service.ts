import { Injectable, NotFoundException } from "@nestjs/common";
import type { Selectable } from "kysely";
import { DatabaseService } from "../database/database.service.js";
import type { AccountSetsTable } from "../database/schema.js";
import type { CreateAccountSet } from "./account-set.dto.js";
import { SubjectsService } from "../subjects/subjects.service.js";

export type AccountSet = Selectable<AccountSetsTable>;

@Injectable()
export class AccountSetsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly subjects: SubjectsService,
  ) {}

  async list(): Promise<AccountSet[]> {
    return this.database
      .requireDatabase()
      .selectFrom("account_sets")
      .selectAll()
      .orderBy("id")
      .execute();
  }

  async get(id: number): Promise<AccountSet> {
    const accountSet = await this.database
      .requireDatabase()
      .selectFrom("account_sets")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!accountSet) throw new NotFoundException("Account set not found");
    return accountSet;
  }

  async create(input: CreateAccountSet): Promise<AccountSet> {
    const db = this.database.requireDatabase();
    const accountSetId = await db.transaction().execute(async (trx) => {
      const result = await trx
        .insertInto("account_sets")
        .values({
          company_name: input.companyName,
          base_currency: input.baseCurrency,
          accounting_standard: input.accountingStandard,
          enabled_from: input.enabledFrom,
          current_period: input.currentPeriod,
        })
        .executeTakeFirstOrThrow();
      const id = Number(result.insertId);
      const [year, month] = input.currentPeriod.split("-").map(Number);
      await trx
        .insertInto("accounting_periods")
        .values({ account_set_id: id, year, month, status: "open" })
        .execute();
      return id;
    });

    await this.subjects.initialize(accountSetId);
    return this.get(accountSetId);
  }
}
