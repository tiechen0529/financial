<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  getAccountingPeriods,
  getIncomeStatement,
  type IncomeStatement,
} from "../lib/api";

const props = defineProps<{ accountSetId: number }>();
const report = ref<IncomeStatement | null>(null);
const year = ref(new Date().getFullYear());
const month = ref(new Date().getMonth() + 1);
const loading = ref(false);
const error = ref("");

async function load(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    report.value = await getIncomeStatement(
      props.accountSetId,
      year.value,
      month.value,
    );
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "利润表加载失败";
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
        <p class="eyebrow">INCOME STATEMENT</p>
        <h2>利润表</h2>
        <p class="panel-description">
          按账套会计制度预置的科目映射计算；发生额仅包含已记账凭证。
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
    <div v-if="report" class="table-scroll">
      <table class="data-table income-statement-table">
        <thead>
          <tr>
            <th>项目</th>
            <th>本期金额</th>
            <th>本年累计</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="line in report.lines"
            :key="line.id"
            :class="{ 'statement-bold': line.isBold }"
          >
            <td
              :style="{
                paddingLeft: `${12 + Math.max(0, line.level - 1) * 18}px`,
              }"
            >
              {{ line.title }}
            </td>
            <td class="money-cell">{{ line.currentPeriodAmount }}</td>
            <td class="money-cell">{{ line.currentYearAmount }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
