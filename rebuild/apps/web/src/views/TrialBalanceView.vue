<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  getAccountingPeriods,
  getTrialBalance,
  type TrialBalance,
} from "../lib/api";

const props = defineProps<{ accountSetId: number }>();
const report = ref<TrialBalance | null>(null);
const year = ref(new Date().getFullYear());
const month = ref(new Date().getMonth() + 1);
const loading = ref(false);
const error = ref("");
const showAll = ref(false);

function hasBalance(value: string): boolean {
  return !/^0(?:\.0+)?$/.test(value);
}

const visibleLines = computed(() => {
  if (!report.value || showAll.value) return report.value?.lines ?? [];
  return report.value.lines.filter((line) =>
    [
      line.beginningDebit,
      line.beginningCredit,
      line.currentDebit,
      line.currentCredit,
      line.endingDebit,
      line.endingCredit,
    ].some(hasBalance),
  );
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    report.value = await getTrialBalance(
      props.accountSetId,
      year.value,
      month.value,
    );
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "试算平衡表加载失败";
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    const data = await getAccountingPeriods(props.accountSetId);
    const current = data.currentPeriod.slice(0, 10);
    year.value = Number(current.slice(0, 4));
    month.value = Number(current.slice(5, 7));
  } catch {
    // The report endpoint shows the actionable database/period error.
  }
  await load();
});
</script>

<template>
  <section class="workspace-panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">GENERAL LEDGER</p>
        <h2>试算平衡表</h2>
        <p class="panel-description">
          依据已记账凭证与科目期初余额计算；未记账草稿不计入。
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
    <div v-if="report" class="report-toolbar">
      <span
        >{{ report.period.year }}年{{
          String(report.period.month).padStart(2, "0")
        }}月</span
      >
      <label><input v-model="showAll" type="checkbox" /> 显示零余额科目</label>
    </div>
    <div v-if="report" class="table-scroll">
      <table class="data-table trial-balance-table">
        <thead>
          <tr>
            <th rowspan="2">科目编码</th>
            <th rowspan="2">科目名称</th>
            <th colspan="2">期初余额</th>
            <th colspan="2">本期发生额</th>
            <th colspan="2">期末余额</th>
          </tr>
          <tr>
            <th>借方</th>
            <th>贷方</th>
            <th>借方</th>
            <th>贷方</th>
            <th>借方</th>
            <th>贷方</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="line in visibleLines"
            :key="line.id"
            :class="{ 'summary-row': line.has_children }"
          >
            <td class="code-cell">{{ line.code }}</td>
            <td>{{ line.name }}</td>
            <td class="money-cell">{{ line.beginningDebit }}</td>
            <td class="money-cell">{{ line.beginningCredit }}</td>
            <td class="money-cell">{{ line.currentDebit }}</td>
            <td class="money-cell">{{ line.currentCredit }}</td>
            <td class="money-cell">{{ line.endingDebit }}</td>
            <td class="money-cell">{{ line.endingCredit }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th colspan="2">合计</th>
            <th class="money-cell">{{ report.total.beginningDebit }}</th>
            <th class="money-cell">{{ report.total.beginningCredit }}</th>
            <th class="money-cell">{{ report.total.currentDebit }}</th>
            <th class="money-cell">{{ report.total.currentCredit }}</th>
            <th class="money-cell">{{ report.total.endingDebit }}</th>
            <th class="money-cell">{{ report.total.endingCredit }}</th>
          </tr>
        </tfoot>
      </table>
    </div>
    <p v-if="report && report.lines.length === 0" class="empty-state">
      账套中还没有科目。
    </p>
  </section>
</template>
