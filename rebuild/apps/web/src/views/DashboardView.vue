<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import {
  checkDatabaseReadiness,
  createAccountSet,
  getHealth,
  listAccountSets,
  type AccountSet,
} from "../lib/api";
import SubjectsView from "./SubjectsView.vue";
import VouchersView from "./VouchersView.vue";
import TrialBalanceView from "./TrialBalanceView.vue";
import PeriodsView from "./PeriodsView.vue";
import LedgerView from "./LedgerView.vue";
import IncomeStatementView from "./IncomeStatementView.vue";
import BalanceSheetView from "./BalanceSheetView.vue";

const apiAvailable = ref<boolean | null>(null);
const databaseAvailable = ref<boolean | null>(null);
const accountSets = ref<AccountSet[]>([]);
const selectedAccountSetId = ref<number | null>(null);
const accountSetsError = ref("");
const saving = ref(false);
const activeModule = ref("subjects");
const modules = [
  { id: "subjects", label: "会计科目" },
  { id: "vouchers", label: "记账凭证" },
  { id: "ledger", label: "总账 / 明细账" },
  { id: "trial-balance", label: "试算平衡表" },
  { id: "income-statement", label: "利润表" },
  { id: "balance-sheet", label: "资产负债汇总" },
  { id: "periods", label: "会计期间" },
];

const today = new Date();
const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
const form = reactive({
  companyName: "",
  baseCurrency: "CNY",
  accountingStandard: "enterprise",
  enabledFrom: monthStart,
  currentPeriod: monthStart,
});

async function loadAccountSets(): Promise<void> {
  try {
    accountSets.value = await listAccountSets();
    if (selectedAccountSetId.value === null && accountSets.value.length > 0) {
      selectedAccountSetId.value = accountSets.value[0].id;
    }
    accountSetsError.value = "";
  } catch (error) {
    accountSetsError.value =
      error instanceof Error ? error.message : "账套列表暂不可用";
  }
}

async function submitAccountSet(): Promise<void> {
  saving.value = true;
  accountSetsError.value = "";
  try {
    const created = await createAccountSet({ ...form });
    accountSets.value.push(created);
    selectedAccountSetId.value = created.id;
    form.companyName = "";
  } catch (error) {
    accountSetsError.value =
      error instanceof Error ? error.message : "创建账套失败";
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    await getHealth();
    apiAvailable.value = true;
    await checkDatabaseReadiness();
    databaseAvailable.value = true;
    await loadAccountSets();
  } catch (error) {
    if (apiAvailable.value) {
      databaseAvailable.value = false;
      accountSetsError.value =
        error instanceof Error ? error.message : "本地数据库暂不可用";
    } else {
      apiAvailable.value = false;
    }
  }
});
</script>

<template>
  <main class="shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="纷析云财务首页">
        <span class="brand-mark">财</span>
        <span>纷析云<span class="brand-light"> · 财务</span></span>
      </a>
      <span class="environment">重建版 · 局域网预览</span>
    </header>

    <section class="welcome">
      <p class="eyebrow">FINANCIAL WORKSPACE</p>
      <h1>让每一笔账，都有清晰来处。</h1>
      <p class="intro">
        科目、凭证、总账、试算平衡与利润表已接入；资产负债汇总仍待会计复核，现金流和完整结账继续迁移中。
      </p>
    </section>

    <section class="status-card" aria-live="polite">
      <div class="status-icon" :class="{ online: apiAvailable }">
        {{ apiAvailable ? "✓" : "↗" }}
      </div>
      <div>
        <h2>服务状态</h2>
        <p v-if="apiAvailable === null">正在检查本地 API…</p>
        <p v-else-if="apiAvailable && databaseAvailable === null">
          API 已连接，正在检查数据库…
        </p>
        <p v-else-if="apiAvailable && !databaseAvailable">
          API 已连接，但数据库尚未就绪。
        </p>
        <p v-else-if="apiAvailable">
          API 和数据库已就绪，可以使用已迁移的账务核心模块。
        </p>
        <p v-else>API 尚未启动。运行 <code>npm run dev</code> 后刷新页面。</p>
      </div>
      <span class="status-label" :class="{ online: apiAvailable }">
        {{
          !apiAvailable
            ? apiAvailable === null
              ? "检查中"
              : "离线"
            : databaseAvailable
              ? "就绪"
              : "数据库未就绪"
        }}
      </span>
    </section>

    <section class="accounts">
      <div class="section-heading">
        <div>
          <p class="eyebrow">YOUR BOOKS</p>
          <h2>账套</h2>
        </div>
        <span>{{ accountSets.length }} 个账套</span>
      </div>
      <p v-if="accountSetsError" class="notice" role="status">
        {{ accountSetsError }}。请确认 MySQL 已启动并执行数据库迁移。
      </p>
      <div v-if="accountSets.length" class="account-list">
        <button
          v-for="accountSet in accountSets"
          :key="accountSet.id"
          class="account-chip"
          :class="{ selected: selectedAccountSetId === accountSet.id }"
          type="button"
          @click="selectedAccountSetId = accountSet.id"
        >
          <span class="account-initial">{{
            accountSet.company_name.slice(0, 1)
          }}</span>
          <span class="account-info">
            <strong>{{ accountSet.company_name }}</strong>
            <small
              >{{ accountSet.base_currency }} ·
              {{ accountSet.current_period }}</small
            >
          </span>
          <span
            v-if="selectedAccountSetId === accountSet.id"
            class="selected-mark"
            >✓</span
          >
        </button>
      </div>
      <p v-else-if="!accountSetsError" class="empty-state">
        还没有账套，创建一个本地账务工作区。
      </p>

      <form class="create-form" @submit.prevent="submitAccountSet">
        <label>
          <span>公司名称</span>
          <input
            v-model="form.companyName"
            autocomplete="organization"
            maxlength="160"
            required
          />
        </label>
        <label>
          <span>记账本位币</span>
          <input
            v-model="form.baseCurrency"
            maxlength="3"
            pattern="[A-Za-z]{3}"
            required
          />
        </label>
        <label>
          <span>启用日期</span>
          <input v-model="form.enabledFrom" type="date" required />
        </label>
        <label>
          <span>当前期间起始日</span>
          <input v-model="form.currentPeriod" type="date" required />
        </label>
        <label class="standard-field">
          <span>会计制度</span>
          <select v-model="form.accountingStandard" required>
            <option value="enterprise">企业会计准则</option>
            <option value="small_enterprise">小企业会计准则</option>
          </select>
        </label>
        <button
          class="create-button"
          :disabled="saving || !databaseAvailable"
          type="submit"
        >
          {{ saving ? "正在创建…" : "创建账套" }}
        </button>
      </form>
    </section>

    <nav v-if="selectedAccountSetId" class="module-nav" aria-label="账务模块">
      <button
        v-for="module in modules"
        :key="module.id"
        type="button"
        :class="{ active: activeModule === module.id }"
        @click="activeModule = module.id"
      >
        {{ module.label }}
      </button>
    </nav>

    <SubjectsView
      v-if="selectedAccountSetId && activeModule === 'subjects'"
      :key="selectedAccountSetId"
      :account-set-id="selectedAccountSetId"
    />
    <VouchersView
      v-else-if="selectedAccountSetId && activeModule === 'vouchers'"
      :key="selectedAccountSetId"
      :account-set-id="selectedAccountSetId"
    />
    <LedgerView
      v-else-if="selectedAccountSetId && activeModule === 'ledger'"
      :key="selectedAccountSetId"
      :account-set-id="selectedAccountSetId"
    />
    <TrialBalanceView
      v-else-if="selectedAccountSetId && activeModule === 'trial-balance'"
      :key="selectedAccountSetId"
      :account-set-id="selectedAccountSetId"
    />
    <IncomeStatementView
      v-else-if="selectedAccountSetId && activeModule === 'income-statement'"
      :key="selectedAccountSetId"
      :account-set-id="selectedAccountSetId"
    />
    <BalanceSheetView
      v-else-if="selectedAccountSetId && activeModule === 'balance-sheet'"
      :key="selectedAccountSetId"
      :account-set-id="selectedAccountSetId"
    />
    <PeriodsView
      v-else-if="selectedAccountSetId && activeModule === 'periods'"
      :key="selectedAccountSetId"
      :account-set-id="selectedAccountSetId"
    />

    <footer>
      本重建版不包含短信与内置身份认证。当前服务监听局域网网卡，请勿暴露到公网。
    </footer>
  </main>
</template>
