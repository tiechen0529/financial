<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  createSubject,
  initializeSubjects,
  listSubjects,
  updateSubjectOpeningBalance,
  type Subject,
  type SubjectInput,
} from "../lib/api";

const props = defineProps<{ accountSetId: number }>();
const subjects = ref<Subject[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const notice = ref("");
const search = ref("");
const showCreateForm = ref(false);
const openingSubject = ref<Subject | null>(null);
const opening = reactive({ debit: "0", credit: "0" });
const form = reactive<SubjectInput>({
  code: "",
  name: "",
  parentId: null,
  balanceDirection: "debit",
  subjectType: "资产",
  openingDebit: "0",
  openingCredit: "0",
});

const childIds = computed(
  () =>
    new Set(subjects.value.map((subject) => subject.parent_id).filter(Boolean)),
);
const filteredSubjects = computed(() => {
  const key = search.value.trim().toLocaleLowerCase();
  if (!key) return subjects.value;
  return subjects.value.filter(
    (subject) =>
      subject.code.toLocaleLowerCase().includes(key) ||
      subject.name.toLocaleLowerCase().includes(key),
  );
});
const subjectById = computed(
  () => new Map(subjects.value.map((subject) => [subject.id, subject])),
);

function level(subject: Subject): number {
  let depth = 0;
  let parentId = subject.parent_id;
  while (parentId !== null) {
    depth++;
    parentId = subjectById.value.get(parentId)?.parent_id ?? null;
  }
  return depth;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    subjects.value = await listSubjects(props.accountSetId);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "科目加载失败";
  } finally {
    loading.value = false;
  }
}

async function initialize(): Promise<void> {
  saving.value = true;
  error.value = "";
  try {
    const result = await initializeSubjects(props.accountSetId);
    notice.value = `已导入 ${result.inserted} 个科目`;
    await load();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "科目模板导入失败";
  } finally {
    saving.value = false;
  }
}

async function saveSubject(): Promise<void> {
  saving.value = true;
  error.value = "";
  notice.value = "";
  try {
    await createSubject(props.accountSetId, { ...form });
    form.code = "";
    form.name = "";
    form.parentId = null;
    form.openingDebit = "0";
    form.openingCredit = "0";
    showCreateForm.value = false;
    notice.value = "科目已创建";
    await load();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "科目创建失败";
  } finally {
    saving.value = false;
  }
}

function editOpening(subject: Subject): void {
  openingSubject.value = subject;
  opening.debit = subject.opening_debit;
  opening.credit = subject.opening_credit;
}

async function saveOpening(): Promise<void> {
  if (!openingSubject.value) return;
  saving.value = true;
  error.value = "";
  try {
    await updateSubjectOpeningBalance(
      props.accountSetId,
      openingSubject.value.id,
      opening.debit,
      opening.credit,
    );
    openingSubject.value = null;
    notice.value = "期初余额已保存";
    await load();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "期初余额保存失败";
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
        <p class="eyebrow">CHART OF ACCOUNTS</p>
        <h2>会计科目</h2>
        <p class="panel-description">
          维护科目结构与期初余额；已用于记账的科目不可删除或调整期初。
        </p>
      </div>
      <div class="panel-actions">
        <button class="secondary-button" :disabled="loading" @click="load">
          刷新
        </button>
        <button
          v-if="subjects.length"
          class="primary-button"
          @click="showCreateForm = !showCreateForm"
        >
          {{ showCreateForm ? "收起" : "新增科目" }}
        </button>
        <button
          v-else
          class="primary-button"
          :disabled="saving"
          @click="initialize"
        >
          {{ saving ? "正在导入…" : "载入标准科目" }}
        </button>
      </div>
    </div>

    <p v-if="error" class="notice error-notice" role="alert">{{ error }}</p>
    <p v-if="notice" class="notice success-notice" role="status">
      {{ notice }}
    </p>

    <form
      v-if="showCreateForm"
      class="subject-form"
      @submit.prevent="saveSubject"
    >
      <label>
        <span>科目编码</span>
        <input v-model="form.code" maxlength="32" required />
      </label>
      <label>
        <span>科目名称</span>
        <input v-model="form.name" maxlength="160" required />
      </label>
      <label>
        <span>上级科目</span>
        <select v-model.number="form.parentId">
          <option :value="null">一级科目</option>
          <option
            v-for="subject in subjects"
            :key="subject.id"
            :value="subject.id"
          >
            {{ subject.code }} · {{ subject.name }}
          </option>
        </select>
      </label>
      <label>
        <span>科目类别</span>
        <select v-model="form.subjectType">
          <option>资产</option>
          <option>负债</option>
          <option>共同</option>
          <option>所有者权益</option>
          <option>成本</option>
          <option>损益</option>
          <option>其他</option>
        </select>
      </label>
      <label>
        <span>余额方向</span>
        <select v-model="form.balanceDirection">
          <option value="debit">借方</option>
          <option value="credit">贷方</option>
        </select>
      </label>
      <button class="primary-button" type="submit" :disabled="saving">
        {{ saving ? "保存中…" : "保存科目" }}
      </button>
    </form>

    <div class="table-toolbar">
      <span>{{ subjects.length }} 个科目</span>
      <input
        v-model="search"
        placeholder="搜索编码或名称"
        aria-label="搜索科目"
      />
    </div>
    <div class="table-scroll">
      <table class="data-table subjects-table">
        <thead>
          <tr>
            <th>编码</th>
            <th>科目名称</th>
            <th>类别</th>
            <th>方向</th>
            <th>期初借方</th>
            <th>期初贷方</th>
            <th>状态</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="subject in filteredSubjects" :key="subject.id">
            <td class="code-cell">{{ subject.code }}</td>
            <td :style="{ paddingLeft: `${12 + level(subject) * 18}px` }">
              {{ subject.name }}
            </td>
            <td>{{ subject.subject_type }}</td>
            <td>{{ subject.balance_direction === "debit" ? "借" : "贷" }}</td>
            <td class="money-cell">{{ subject.opening_debit }}</td>
            <td class="money-cell">{{ subject.opening_credit }}</td>
            <td>
              <span
                :class="
                  subject.is_enabled ? 'status-pill' : 'status-pill muted'
                "
                >{{ subject.is_enabled ? "启用" : "停用" }}</span
              >
            </td>
            <td>
              <button
                v-if="!childIds.has(subject.id)"
                class="text-button"
                @click="editOpening(subject)"
              >
                期初余额
              </button>
            </td>
          </tr>
          <tr v-if="!loading && filteredSubjects.length === 0">
            <td colspan="8" class="table-empty">
              {{ subjects.length ? "没有匹配的科目" : "尚未导入科目模板" }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="openingSubject"
      class="dialog-backdrop"
      @click.self="openingSubject = null"
    >
      <form class="dialog-card" @submit.prevent="saveOpening">
        <h3>设置期初余额</h3>
        <p>{{ openingSubject.code }} · {{ openingSubject.name }}</p>
        <label
          ><span>借方余额</span
          ><input v-model="opening.debit" inputmode="decimal" required
        /></label>
        <label
          ><span>贷方余额</span
          ><input v-model="opening.credit" inputmode="decimal" required
        /></label>
        <p class="dialog-hint">
          借方和贷方不能同时填写非零金额。记账后期初余额将锁定。
        </p>
        <div class="dialog-actions">
          <button
            type="button"
            class="secondary-button"
            @click="openingSubject = null"
          >
            取消
          </button>
          <button class="primary-button" :disabled="saving">保存</button>
        </div>
      </form>
    </div>
  </section>
</template>
