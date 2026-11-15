<script setup lang="ts">
import { ArrowUpRight, BookOpen, CalendarDays, Check, Users, CheckCircle2 } from 'lucide-vue-next';
import { ref } from 'vue';
import type { Workspace } from '../workspace';
const { workspace } = defineProps<{ workspace: Workspace }>();
const { students, studentId, role, loading, error, currentStudent, load } = workspace;
const emit = defineEmits<{ enter: [] }>();
const entering = ref(false);
const entryRole = ref<'teacher' | 'student' | null>(null);
const entryStudentId = ref<number | null>(null);
const entryError = ref('');
async function enterWorkspace() {
  if (!entryRole.value || entering.value) return;
  entryError.value = '';
  const requestedStudent = entryStudentId.value;
  if (entryRole.value === 'student' && !students.value.some((s) => s.id === requestedStudent)) {
    entryError.value = '이용할 학생을 선택해 주세요.';
    return;
  }
  entering.value = true;
  if (entryRole.value === 'student') studentId.value = requestedStudent!;
  role.value = entryRole.value;
  await load();
  if (error.value) entryError.value = error.value;
  else if (
    entryRole.value === 'student' &&
    (studentId.value !== requestedStudent || !currentStudent.value)
  ) {
    entryStudentId.value = null;
    entryError.value = '선택한 학생 정보를 찾을 수 없습니다. 다시 선택해 주세요.';
  } else {
    workspace.navigate('rooms');
    emit('enter');
    window.scrollTo(0, 0);
  }
  entering.value = false;
}
</script>
<template>
  <div class="entry-shell">
    <header class="entry-header">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">s<span>.</span></span
        ><span class="brand-name"
          >시대인재 <span class="brand-divider">/</span> <strong>자습실</strong></span
        >
      </div>
      <span class="entry-header-note">STUDY ROOM</span>
    </header>
    <main class="entry-main">
      <section class="entry-intro">
        <span class="entry-kicker"><span class="dot"></span> 공부에 집중할 수 있도록</span>
        <h1>자습실 이용을<br />시작하세요.</h1>
        <p>강사는 공간을 관리하고,<br />학생은 나에게 맞는 방문 시간을 신청해요.</p>
        <div class="entry-illustration" aria-hidden="true">
          <div class="entry-grid"></div>
          <div class="entry-ticket">
            <span class="ticket-label">나의 다음 공부</span>
            <div class="ticket-title">자습실 방문 <ArrowUpRight :size="22" /></div>
            <div class="ticket-rule"></div>
            <span class="ticket-bottom"
              ><CalendarDays :size="17" /> 나에게 맞는 시간에 <CheckCircle2 :size="18"
            /></span>
          </div>
          <span class="entry-orbit"></span><span class="entry-square"></span>
        </div>
      </section>
      <section class="entry-card" aria-labelledby="entry-title">
        <div class="entry-step">시작하기</div>
        <h2 id="entry-title">어떻게 이용하시나요?</h2>
        <p class="entry-description">이용 유형에 맞는 화면으로 안내해 드릴게요.</p>
        <div class="entry-roles" role="group" aria-label="이용 유형">
          <button
            class="entry-role"
            :class="{ chosen: entryRole === 'teacher' }"
            :aria-pressed="entryRole === 'teacher'"
            :disabled="entering"
            @click="
              entryRole = 'teacher';
              entryError = '';
            "
          >
            <span class="entry-role-icon"><BookOpen :size="24" /></span><strong>강사</strong
            ><span>자습실·학생 관리</span
            ><span class="entry-check"><Check :size="13" v-if="entryRole === 'teacher'" /></span>
          </button>
          <button
            class="entry-role"
            :class="{ chosen: entryRole === 'student' }"
            :aria-pressed="entryRole === 'student'"
            :disabled="entering"
            @click="
              entryRole = 'student';
              entryError = '';
            "
          >
            <span class="entry-role-icon"><Users :size="24" /></span><strong>학생</strong
            ><span>방문 신청·내 일정</span
            ><span class="entry-check"><Check :size="13" v-if="entryRole === 'student'" /></span>
          </button>
        </div>
        <div v-if="entryRole === 'student'" class="entry-student">
          <label for="entry-student">학생 선택</label
          ><select
            id="entry-student"
            v-model="entryStudentId"
            :disabled="entering || loading || !students.length"
          >
            <option :value="null" disabled>이름을 선택해 주세요</option>
            <option v-for="s in students" :key="s.id" :value="s.id">
              {{ s.name }} · {{ String(s.id).padStart(3, '0') }}
            </option>
          </select>
          <p v-if="!loading && !students.length">
            등록된 학생이 없습니다. 강사 화면에서 학생을 먼저 등록해 주세요.
          </p>
        </div>
        <div v-if="entryError || error" class="alert entry-alert" role="alert">
          {{ entryError || error
          }}<button
            v-if="error"
            @click="
              entryError = '';
              load();
            "
            :disabled="loading"
          >
            다시 불러오기
          </button>
        </div>
        <button
          class="primary entry-submit"
          :disabled="
            entering || loading || !entryRole || (entryRole === 'student' && !entryStudentId)
          "
          @click="enterWorkspace"
        >
          {{
            entering
              ? '입장하는 중…'
              : loading
                ? '정보를 불러오는 중…'
                : entryRole === 'teacher'
                  ? '강사로 시작하기'
                  : entryRole === 'student'
                    ? '학생으로 시작하기'
                    : '이용 유형을 선택해 주세요'
          }}<ArrowUpRight v-if="entryRole && !entering" :size="19" />
        </button>
        <p class="entry-help">별도 가입 없이 이용할 수 있는 체험용 서비스입니다.</p>
      </section>
    </main>
    <footer class="entry-footer">
      <span>시대인재 · 자습실</span><small>공간과 시간을 연결하는 학습 관리</small>
    </footer>
  </div>
</template>
