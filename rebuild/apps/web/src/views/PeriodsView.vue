<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  closeAccountingPeriod,
  getAccountingPeriods,
  reopenAccountingPeriod,
  type AccountingPeriod,
} from "../lib/api";

const props = defineProps<{ accountSetId: number }>();
const periods = ref<AccountingPeriod[]>([]);
const currentPeriod = ref("");
const loading = ref(false);
const error = ref("");
const notice = ref("");

async function load(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    const result = await getAccountingPeriods(props.accountSetId);
    periods.value = result.periods;
    currentPeriod.value = result.currentPeriod.slice(0, 10);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "会计期间加载失败";
  } finally {
    loading.value = false;
  }
}

async function close(period: AccountingPeriod): Promise<void> {
  if (
    !window.confirm(
      `${period.year}年${period.month}月结账后将锁定本期凭证并推进下一期间。继续吗？`,
    )
  )
    return;
  error.value = "";
  notice.value = "";
  try {
    await closeAccountingPeriod(props.accountSetId, period.year, period.month);
    notice.value = "期间已结账并推进到下一月";
    await load();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "结账失败";
  }
}

async function reopen(period: AccountingPeriod): Promise<void> {
  if (
    !window.confirm(
      `${period.year}年${period.month}月反结账后将重新开放凭证录入。继续吗？`,
    )
  )
    return;
  error.value = "";
  notice.value = "";
  try {
    await reopenAccountingPeriod(props.accountSetId, period.year, period.month);
    notice.value = "期间已重新开放";
    await load();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "反结账失败";
  }
}

function isCurrent(period: AccountingPeriod): boolean {
  return (
    currentPeriod.value.slice(0, 7) ===
    `${period.year}-${String(period.month).padStart(2, "0")}`
  );
}

function canReopen(period: AccountingPeriod): boolean {
  const nextYear = period.month === 12 ? period.year + 1 : period.year;
  const nextMonth = period.month === 12 ? 1 : period.month + 1;
  return (
    currentPeriod.value.slice(0, 7) ===
    `${nextYear}-${String(nextMonth).padStart(2, "0")}`
  );
}

onMounted(load);
</script>

<template>
  <section class="workspace-panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">ACCOUNTING PERIODS</p>
        <h2>会计期间</h2>
        <p class="panel-description">
          结账会锁定当前期间并创建下一期间；反结账仅允许撤回最近一次且下一期没有凭证。
        </p>
      </div>
      <button class="secondary-button" :disabled="loading" @click="load">
        刷新
      </button>
    </div>
    <div class="notice warning-notice">
      当前实现提供期间锁定与推进，不会自动生成损益结转凭证；正式月结/年结流程仍需继续迁移并经会计核验。
    </div>
    <p v-if="error" class="notice error-notice" role="alert">{{ error }}</p>
    <p v-if="notice" class="notice success-notice" role="status">
      {{ notice }}
    </p>
    <div class="period-current">
      <span>当前期间</span>
      <strong>{{
        currentPeriod
          ? `${currentPeriod.slice(0, 4)}年${currentPeriod.slice(5, 7)}月`
          : "读取中…"
      }}</strong>
    </div>
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>年度</th>
            <th>月份</th>
            <th>状态</th>
            <th>关闭时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="period in periods" :key="period.id">
            <td>{{ period.year }}</td>
            <td>{{ String(period.month).padStart(2, "0") }}</td>
            <td>
              <span
                :class="
                  period.status === 'open' ? 'status-pill' : 'status-pill muted'
                "
                >{{ period.status === "open" ? "开放" : "已关闭" }}</span
              >
            </td>
            <td>
              {{
                period.closed_at
                  ? new Date(period.closed_at).toLocaleString()
                  : "—"
              }}
            </td>
            <td class="period-actions">
              <button
                v-if="period.status === 'open' && isCurrent(period)"
                class="text-button danger-button"
                @click="close(period)"
              >
                结账 / 锁定
              </button>
              <button
                v-else-if="period.status === 'closed' && canReopen(period)"
                class="text-button"
                @click="reopen(period)"
              >
                反结账
              </button>
              <span v-else class="muted-text">—</span>
            </td>
          </tr>
          <tr v-if="periods.length === 0">
            <td colspan="5" class="table-empty">没有会计期间</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
