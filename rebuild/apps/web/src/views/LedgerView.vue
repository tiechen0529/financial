<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  getAccountingPeriods,
  getGeneralLedger,
  getSubjectDetail,
  type SubjectDetailReport,
  type TrialBalanceLine,
} from "../lib/api";

const props = defineProps<{ accountSetId: number }>();
const lines = ref<TrialBalanceLine[]>([]);
const detail = ref<SubjectDetailReport | null>(null);
const year = ref(new Date().getFullYear());
const month = ref(new Date().getMonth() + 1);
const loading = ref(false);
const error = ref("");

async function load(): Promise<void> {
  loading.value = true;
  error.value = "";
  detail.value = null;
  try {
    const result = await getGeneralLedger(
      props.accountSetId,
      year.value,
      month.value,
    );
    lines.value = result.lines;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "总账加载失败";
  } finally {
    loading.value = false;
  }
}

async function openDetail(subjectId: number): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    detail.value = await getSubjectDetail(
      props.accountSetId,
      subjectId,
      year.value,
      month.value,
    );
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "明细账加载失败";
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    const periods = await getAccountingPeriods(props.accountSetId);
    const current = periods.currentPeriod.slice(0, 10);
    year.value = Number(current.slice(0, 4));
    month.value = Number(current.slice(5, 7));
  } catch {
    // The report endpoint provides the actionable error.
  }
  await load();
});
</script>

<template>
  <section class="workspace-panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">GENERAL & SUBSIDIARY LEDGER</p>
        <h2>{{ detail ? "科目明细账" : "总账" }}</h2>
        <p class="panel-description">
          仅汇总已记账凭证；选择科目可查看逐笔发生与滚动余额。
        </p>
      </div>
      <div class="period-filter">
        <label
          >年 <input v-model.number="year" type="number" min="1" max="9999"
        /></label>
        <label
          >月 <input v-model.number="month" type="number" min="1" max="12"
        /></label>
        <button class="primary-button" :disabled="loading" @click="load">
          查询
        </button>
      </div>
    </div>
    <p v-if="error" class="notice error-notice" role="alert">{{ error }}</p>

    <template v-if="detail">
      <div class="ledger-detail-heading">
        <button class="secondary-button" @click="detail = null">
          ← 返回总账
        </button>
        <strong>{{ detail.subject.code }} · {{ detail.subject.name }}</strong>
        <span
          >期初
          {{
            detail.beginning.direction === "balanced"
              ? "平"
              : detail.beginning.direction === "debit"
                ? "借"
                : "贷"
          }}
          {{ detail.beginning.balance }}</span
        >
      </div>
      <div class="table-scroll">
        <table class="data-table ledger-detail-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>凭证字号</th>
              <th>摘要</th>
              <th>借方</th>
              <th>贷方</th>
              <th>方向</th>
              <th>余额</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in detail.lines" :key="line.id">
              <td>{{ line.voucherDate.slice(0, 10) }}</td>
              <td>
                {{ line.voucherWord
                }}{{ String(line.voucherNumber).padStart(3, "0") }}-{{
                  line.lineNumber
                }}
              </td>
              <td>{{ line.summary || "—" }}</td>
              <td class="money-cell">{{ line.debitAmount }}</td>
              <td class="money-cell">{{ line.creditAmount }}</td>
              <td>
                {{
                  line.balanceDirection === "balanced"
                    ? "平"
                    : line.balanceDirection === "debit"
                      ? "借"
                      : "贷"
                }}
              </td>
              <td class="money-cell">{{ line.balance }}</td>
            </tr>
            <tr v-if="detail.lines.length === 0">
              <td colspan="7" class="table-empty">本期没有已记账发生额</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th colspan="3">本期合计 / 期末余额</th>
              <th class="money-cell">{{ detail.total.debit }}</th>
              <th class="money-cell">{{ detail.total.credit }}</th>
              <th>
                {{
                  detail.total.endingDirection === "balanced"
                    ? "平"
                    : detail.total.endingDirection === "debit"
                      ? "借"
                      : "贷"
                }}
              </th>
              <th class="money-cell">{{ detail.total.endingBalance }}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>

    <template v-else>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>编码</th>
              <th>科目</th>
              <th>类别</th>
              <th>期初借</th>
              <th>期初贷</th>
              <th>本期借</th>
              <th>本期贷</th>
              <th>期末借</th>
              <th>期末贷</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in lines" :key="line.id">
              <td class="code-cell">{{ line.code }}</td>
              <td>{{ line.name }}</td>
              <td>{{ line.subject_type }}</td>
              <td class="money-cell">{{ line.beginningDebit }}</td>
              <td class="money-cell">{{ line.beginningCredit }}</td>
              <td class="money-cell">{{ line.currentDebit }}</td>
              <td class="money-cell">{{ line.currentCredit }}</td>
              <td class="money-cell">{{ line.endingDebit }}</td>
              <td class="money-cell">{{ line.endingCredit }}</td>
              <td>
                <button class="text-button" @click="openDetail(line.id)">
                  明细
                </button>
              </td>
            </tr>
            <tr v-if="lines.length === 0">
              <td colspan="10" class="table-empty">没有科目</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
