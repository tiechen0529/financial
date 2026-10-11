<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  createVoucher,
  deleteVoucher,
  getAccountingPeriods,
  listSubjects,
  listVouchers,
  postVoucher,
  updateVoucher,
  type Subject,
  type Voucher,
  type VoucherInput,
  type VoucherLineInput,
} from "../lib/api";

const props = defineProps<{ accountSetId: number }>();
const subjects = ref<Subject[]>([]);
const vouchers = ref<Voucher[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const notice = ref("");
const year = ref(new Date().getFullYear());
const month = ref(new Date().getMonth() + 1);
const editingId = ref<number | null>(null);
const form = reactive({ voucherDate: "", voucherWord: "记" });
const lines = ref<VoucherLineInput[]>([emptyLine(), emptyLine()]);

function emptyLine(): VoucherLineInput {
  return { subjectId: 0, summary: "", debitAmount: "0", creditAmount: "0" };
}

const children = computed(
  () =>
    new Set(subjects.value.map((subject) => subject.parent_id).filter(Boolean)),
);
const postableSubjects = computed(() =>
  subjects.value.filter(
    (subject) => subject.is_enabled && !children.value.has(subject.id),
  ),
);
const periodLabel = computed(
  () => `${year.value}年${String(month.value).padStart(2, "0")}月`,
);

async function loadVouchers(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    vouchers.value = await listVouchers(
      props.accountSetId,
      year.value,
      month.value,
    );
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "凭证加载失败";
  } finally {
    loading.value = false;
  }
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    const [subjectRows, periodData] = await Promise.all([
      listSubjects(props.accountSetId),
      getAccountingPeriods(props.accountSetId),
    ]);
    subjects.value = subjectRows;
    const current = periodData.currentPeriod.slice(0, 10);
    year.value = Number(current.slice(0, 4));
    month.value = Number(current.slice(5, 7));
    form.voucherDate = current;
    await loadVouchers();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "凭证模块加载失败";
  } finally {
    loading.value = false;
  }
}

function addLine(): void {
  lines.value.push(emptyLine());
}

function removeLine(index: number): void {
  if (lines.value.length > 2) lines.value.splice(index, 1);
}

function beginEdit(voucher: Voucher): void {
  if (voucher.status !== "draft") return;
  editingId.value = voucher.id;
  form.voucherDate = voucher.voucher_date.slice(0, 10);
  form.voucherWord = voucher.voucher_word;
  lines.value = voucher.lines.map((line) => ({
    subjectId: line.subject_id,
    summary: line.summary,
    debitAmount: line.debit_amount,
    creditAmount: line.credit_amount,
  }));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm(): void {
  editingId.value = null;
  form.voucherDate = `${year.value}-${String(month.value).padStart(2, "0")}-01`;
  form.voucherWord = "记";
  lines.value = [emptyLine(), emptyLine()];
}

async function saveDraft(): Promise<void> {
  saving.value = true;
  error.value = "";
  notice.value = "";
  try {
    const input: VoucherInput = {
      voucherDate: form.voucherDate,
      voucherWord: form.voucherWord,
      lines: lines.value.map((line) => ({ ...line })),
    };
    if (editingId.value === null) {
      await createVoucher(props.accountSetId, input);
      notice.value = "凭证草稿已保存";
    } else {
      await updateVoucher(props.accountSetId, editingId.value, input);
      notice.value = "凭证草稿已更新";
    }
    resetForm();
    await loadVouchers();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "凭证保存失败";
  } finally {
    saving.value = false;
  }
}

async function post(voucher: Voucher): Promise<void> {
  if (
    !window.confirm(
      `确认记账 ${voucher.voucher_word}${voucher.voucher_number} 号凭证？记账后不能直接修改。`,
    )
  )
    return;
  saving.value = true;
  error.value = "";
  try {
    await postVoucher(props.accountSetId, voucher.id);
    notice.value = "凭证已记账";
    await loadVouchers();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "记账失败";
  } finally {
    saving.value = false;
  }
}

async function remove(voucher: Voucher): Promise<void> {
  if (
    !window.confirm(
      `删除未记账的 ${voucher.voucher_word}${voucher.voucher_number} 号凭证？`,
    )
  )
    return;
  saving.value = true;
  error.value = "";
  try {
    await deleteVoucher(props.accountSetId, voucher.id);
    notice.value = "未记账凭证已删除";
    await loadVouchers();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "删除失败";
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="workspace-panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">VOUCHERS</p>
        <h2>记账凭证</h2>
        <p class="panel-description">
          草稿保存后不计入账簿；只有借贷平衡的凭证可以正式记账。
        </p>
      </div>
      <div class="period-filter">
        <label
          >年 <input v-model.number="year" type="number" min="1" max="9999"
        /></label>
        <label
          >月 <input v-model.number="month" type="number" min="1" max="12"
        /></label>
        <button class="secondary-button" @click="loadVouchers">查询</button>
      </div>
    </div>

    <p v-if="error" class="notice error-notice" role="alert">{{ error }}</p>
    <p v-if="notice" class="notice success-notice" role="status">
      {{ notice }}
    </p>

    <form class="voucher-editor" @submit.prevent="saveDraft">
      <div class="voucher-editor-heading">
        <h3>
          {{
            editingId === null ? "新增凭证草稿" : `编辑凭证草稿 #${editingId}`
          }}
        </h3>
        <button
          v-if="editingId !== null"
          type="button"
          class="text-button"
          @click="resetForm"
        >
          取消编辑
        </button>
      </div>
      <div class="voucher-meta">
        <label
          ><span>日期</span
          ><input v-model="form.voucherDate" type="date" required
        /></label>
        <label
          ><span>凭证字</span
          ><input v-model="form.voucherWord" maxlength="24" required
        /></label>
      </div>
      <div class="voucher-lines">
        <div class="voucher-line voucher-line-head">
          <span>摘要</span><span>会计科目</span><span>借方金额</span
          ><span>贷方金额</span><span></span>
        </div>
        <div v-for="(line, index) in lines" :key="index" class="voucher-line">
          <input
            v-model="line.summary"
            placeholder="业务摘要"
            maxlength="512"
          />
          <select v-model.number="line.subjectId" required>
            <option :value="0" disabled>选择末级科目</option>
            <option
              v-for="subject in postableSubjects"
              :key="subject.id"
              :value="subject.id"
            >
              {{ subject.code }} · {{ subject.name }}
            </option>
          </select>
          <input
            v-model="line.debitAmount"
            inputmode="decimal"
            placeholder="0"
            required
          />
          <input
            v-model="line.creditAmount"
            inputmode="decimal"
            placeholder="0"
            required
          />
          <button
            type="button"
            class="icon-button"
            :disabled="lines.length <= 2"
            aria-label="删除分录"
            @click="removeLine(index)"
          >
            ×
          </button>
        </div>
      </div>
      <div class="voucher-form-actions">
        <button type="button" class="secondary-button" @click="addLine">
          ＋ 添加分录
        </button>
        <span class="form-hint">借贷金额须相等。保存草稿不会改变余额。</span>
        <button
          class="primary-button"
          :disabled="saving || postableSubjects.length === 0"
        >
          {{ saving ? "保存中…" : "保存草稿" }}
        </button>
      </div>
    </form>

    <div class="section-heading compact-heading">
      <h3>{{ periodLabel }} · {{ vouchers.length }} 张凭证</h3>
      <button class="text-button" @click="loadVouchers">刷新</button>
    </div>
    <div v-if="vouchers.length" class="voucher-list">
      <article
        v-for="voucher in vouchers"
        :key="voucher.id"
        class="voucher-card"
      >
        <div class="voucher-card-head">
          <strong
            >{{ voucher.voucher_word }}
            {{ String(voucher.voucher_number).padStart(3, "0") }} 号</strong
          >
          <span>{{ voucher.voucher_date.slice(0, 10) }}</span>
          <span
            :class="
              voucher.status === 'posted'
                ? 'status-pill'
                : 'status-pill warning'
            "
            >{{ voucher.status === "posted" ? "已记账" : "草稿" }}</span
          >
          <span class="voucher-total"
            >借 {{ voucher.debit_total }} / 贷 {{ voucher.credit_total }}</span
          >
        </div>
        <div class="voucher-card-lines">
          <div v-for="line in voucher.lines" :key="line.id">
            <span>{{ line.summary || "（无摘要）" }}</span>
            <span>{{
              subjects.find((subject) => subject.id === line.subject_id)
                ?.name ?? "科目已删除"
            }}</span>
            <span>借 {{ line.debit_amount }}</span>
            <span>贷 {{ line.credit_amount }}</span>
          </div>
        </div>
        <div v-if="voucher.status === 'draft'" class="voucher-card-actions">
          <button class="text-button" @click="beginEdit(voucher)">编辑</button>
          <button class="text-button danger-button" @click="remove(voucher)">
            删除草稿
          </button>
          <button
            class="primary-button small-button"
            :disabled="saving"
            @click="post(voucher)"
          >
            记账
          </button>
        </div>
      </article>
    </div>
    <p v-else-if="!loading" class="empty-state">
      {{ periodLabel }}还没有凭证。
    </p>
  </section>
</template>
