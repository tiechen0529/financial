<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import {
  createAccountSet,
  getHealth,
  listAccountSets,
  type AccountSet,
} from "../lib/api";

const apiAvailable = ref<boolean | null>(null);
const accountSets = ref<AccountSet[]>([]);
const selectedAccountSetId = ref<number | null>(null);
const accountSetsError = ref("");
const saving = ref(false);

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
    await loadAccountSets();
  } catch {
    apiAvailable.value = false;
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
      <span class="environment">重建版 · 本地工作区</span>
    </header>

    <section class="welcome">
      <p class="eyebrow">FINANCIAL WORKSPACE</p>
      <h1>让每一笔账，都有清晰来处。</h1>
      <p class="intro">
        新账务核心正在搭建。先建立准确、可核验的账务基础，再逐步恢复凭证、账簿与报表。
      </p>
    </section>

    <section class="status-card" aria-live="polite">
      <div class="status-icon" :class="{ online: apiAvailable }">
        {{ apiAvailable ? "✓" : "↗" }}
      </div>
      <div>
        <h2>服务状态</h2>
        <p v-if="apiAvailable === null">正在检查本地 API…</p>
        <p v-else-if="apiAvailable">本地 API 已连接，可以开始迁移账务模块。</p>
        <p v-else>API 尚未启动。运行 <code>npm run dev</code> 后刷新页面。</p>
      </div>
      <span class="status-label" :class="{ online: apiAvailable }">
        {{ apiAvailable ? "在线" : apiAvailable === null ? "检查中" : "离线" }}
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
          <span>会计制度标识</span>
          <input v-model="form.accountingStandard" maxlength="40" required />
        </label>
        <button
          class="create-button"
          :disabled="saving || !apiAvailable"
          type="submit"
        >
          {{ saving ? "正在创建…" : "创建账套" }}
        </button>
      </form>
    </section>

    <section class="module-grid" aria-label="迁移模块">
      <article class="module-card active">
        <span class="module-number">01</span>
        <h2>账务核心</h2>
        <p>账套、科目、会计期间、凭证与分录。金额边界使用十进制定点数。</p>
        <span class="tag">基础建设中</span>
      </article>
      <article class="module-card">
        <span class="module-number">02</span>
        <h2>账簿与报表</h2>
        <p>以账务核心为唯一来源，建立可追溯、可对账的汇总与查询。</p>
        <span class="tag muted">待迁移</span>
      </article>
      <article class="module-card">
        <span class="module-number">03</span>
        <h2>期末结账</h2>
        <p>期间锁定、结转和反结账必须有明确事务边界及回归校验。</p>
        <span class="tag muted">待迁移</span>
      </article>
    </section>

    <footer>
      本地工作区默认只监听回环地址；本重建版不包含短信发送和内置身份认证。
    </footer>
  </main>
</template>
