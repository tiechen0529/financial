import { Controller, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import { ReportsService } from "./reports.service.js";

@Controller("account-sets/:accountSetId/reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("balance-sheet")
  async balanceSheet(
    @Param("accountSetId", ParseIntPipe) accountSetId: number,
    @Query("year", ParseIntPipe) year: number,
    @Query("month", ParseIntPipe) month: number,
  ) {
    return {
      data: await this.reports.balanceSheet(accountSetId, year, month),
    };
  }

  @Get("income-statement")
  async incomeStatement(
    @Param("accountSetId", ParseIntPipe) accountSetId: number,
    @Query("year", ParseIntPipe) year: number,
    @Query("month", ParseIntPipe) month: number,
  ) {
    return {
      data: await this.reports.incomeStatement(accountSetId, year, month),
    };
  }

  @Get("general-ledger")
  async generalLedger(
    @Param("accountSetId", ParseIntPipe) accountSetId: number,
    @Query("year", ParseIntPipe) year: number,
    @Query("month", ParseIntPipe) month: number,
  ) {
    return {
      data: await this.reports.generalLedger(accountSetId, year, month),
    };
  }

  @Get("subject-detail")
  async subjectDetail(
    @Param("accountSetId", ParseIntPipe) accountSetId: number,
    @Query("subjectId", ParseIntPipe) subjectId: number,
    @Query("year", ParseIntPipe) year: number,
    @Query("month", ParseIntPipe) month: number,
  ) {
    return {
      data: await this.reports.subjectDetail(
        accountSetId,
        subjectId,
        year,
        month,
      ),
    };
  }

  @Get("trial-balance")
  async trialBalance(
    @Param("accountSetId", ParseIntPipe) accountSetId: number,
    @Query("year", ParseIntPipe) year: number,
    @Query("month", ParseIntPipe) month: number,
  ) {
    return {
      data: await this.reports.trialBalance(accountSetId, year, month),
    };
  }
}
