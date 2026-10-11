<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  getAccountingPeriods,
  getBalanceSheet,
  type BalanceSheet,
} from "../lib/api";

const props = defineProps<{ accountSetId: number }>();
const report = ref<BalanceSheet | null>(null);
const year = ref(new Date().getFullYear());
const month = ref(new Date().getMonth() + 1);
const loading = ref(false);
const error = ref("");

async function load(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    report.value = await getBalanceSheet(
      props.accountSetId,
      year.value,
      month.value,
    );
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "资产负债汇总加载失败";
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
        <p class="eyebrow">BALANCE SHEET</p>
        <h2>资产负债汇总</h2>
        <p class="panel-description">
          暂按科目类别汇总，不等同于已完成映射与复核的法定格式资产负债表。
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
          {{ loading ? "查询中…" : "查询" }}
        </button>
      </div>
    </div>
    <p v-if="error" class="notice error-notice" role="alert">{{ error }}</p>
    <template v-if="report">
      <div
        class="balance-check"
        :class="report.totals.balanced ? 'balanced' : 'unbalanced'"
      >
        <span>{{ report.totals.balanced ? "试算平衡" : "账表差额" }}</span>
        <strong>{{ report.totals.difference }}</strong>
        <small>按所选期间已记账数据计算</small>
      </div>
      <div class="statement-columns">
        <div class="statement-section">
          <h3>
            资产 <span>{{ report.totals.assets }}</span>
          </h3>
          <div
            v-for="line in report.assets"
            :key="`a-${line.code}`"
            class="statement-line"
          >
            <span>{{ line.code }} · {{ line.name }}</span
            ><strong>{{ line.amount }}</strong>
          </div>
          <div
            v-for="line in report.other.filter(
              (item) => item.side === 'assets',
            )"
            :key="`oa-${line.code}`"
            class="statement-line"
          >
            <span>{{ line.code }} · {{ line.name }}</span
            ><strong>{{ line.amount }}</strong>
          </div>
        </div>
        <div class="statement-section">
          <h3>
            负债与权益 <span>{{ report.totals.liabilitiesAndEquity }}</span>
          </h3>
          <div
            v-for="line in report.liabilities"
            :key="`l-${line.code}`"
            class="statement-line"
          >
            <span>{{ line.code }} · {{ line.name }}</span
            ><strong>{{ line.amount }}</strong>
          </div>
          <div
            v-for="line in report.equity"
            :key="`e-${line.code}`"
            class="statement-line"
          >
            <span>{{ line.code }} · {{ line.name }}</span
            ><strong>{{ line.amount }}</strong>
          </div>
          <div
            v-for="line in report.other.filter(
              (item) => item.side === 'liabilities',
            )"
            :key="`oc-${line.code}`"
            class="statement-line"
          >
            <span>{{ line.code }} · {{ line.name }}</span
            ><strong>{{ line.amount }}</strong>
          </div>
          <div class="statement-line profit-line">
            <span>本年净利润（尚未结转）</span
            ><strong>{{ report.currentYearProfit }}</strong>
          </div>
        </div>
      </div>
      <p class="statement-footnote">{{ report.basis }}</p>
    </template>
  </section>
</template>
