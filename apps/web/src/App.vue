<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ChevronRight, LogOut, CheckCircle2, Plus } from 'lucide-vue-next';
import EntryScreen from './components/EntryScreen.vue';
import RoomDetail from './components/RoomDetail.vue';
import RoomList from './components/RoomList.vue';
import StudentList from './components/StudentList.vue';
import MyVisits from './components/MyVisits.vue';
import WorkspaceDialog from './components/WorkspaceDialog.vue';
import { createWorkspace } from './workspace';
import type { Room, Visit } from './types';
const workspace = createWorkspace();
const {
  role,
  page,
  rooms,
  students,
  visits,
  selected,
  loading,
  error,
  currentStudent,
  load,
  detail,
  navigate,
} = workspace;
const entered = ref(false);
const dialog = ref<InstanceType<typeof WorkspaceDialog>>();
const busy = computed(() => dialog.value?.busy ?? false);
const modal = computed(() => dialog.value?.isOpen ?? false);
const myActive = computed(() => visits.value.filter((v) => v.status === 'ACTIVE'));
const notice = ref('');
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
function saved() {
  clearTimeout(noticeTimer);
  notice.value = '변경 사항을 저장했습니다.';
  noticeTimer = setTimeout(() => (notice.value = ''), 3500);
}
function book(room: Room, visit?: Visit) {
  dialog.value?.book(room, visit);
}
function leaveWorkspace() {
  if (busy.value) return;
  dialog.value?.close();
  entered.value = false;
  error.value = '';
  notice.value = '';
  clearTimeout(noticeTimer);
  navigate('rooms');
  window.scrollTo(0, 0);
}
onMounted(load);
onUnmounted(() => clearTimeout(noticeTimer));
</script>
<template>
  <EntryScreen v-if="!entered" :workspace="workspace" @enter="entered = true" />
  <div v-else class="app-shell">
    <a :inert="!!modal" class="skip-link" href="#main-content">본문으로 이동</a>
    <header class="app-header" :inert="!!modal">
      <button class="brand" @click="navigate('rooms')" aria-label="자습실 홈">
        <span class="brand-mark" aria-hidden="true">s<span>.</span></span>
        <span class="brand-name"
          >시대인재 <span class="brand-divider">/</span> <strong>자습실</strong></span
        >
      </button>
      <nav aria-label="주 메뉴">
        <button :class="{ active: page === 'rooms' }" @click="navigate('rooms')">
          자습실 <span class="nav-count">{{ rooms.length }}</span>
        </button>
        <button
          v-if="role === 'teacher'"
          :class="{ active: page === 'students' }"
          @click="navigate('students')"
        >
          학생 관리
        </button>
        <button v-else :class="{ active: page === 'mine' }" @click="navigate('mine')">
          내 신청 <span class="nav-count">{{ myActive.length }}</span>
        </button>
      </nav>
      <div class="profile">
        <span class="avatar">{{ role === 'teacher' ? 'T' : 'S' }}</span>
        <strong class="profile-name">{{
          role === 'teacher' ? '강사' : `${currentStudent?.name || '학생'} · 학생`
        }}</strong>
        <button class="exit-button" aria-label="나가기" :disabled="busy" @click="leaveWorkspace">
          <LogOut :size="16" /><span>나가기</span>
        </button>
      </div>
    </header>
    <div class="main-shell">
      <header class="topbar" :inert="!!modal">
        <div class="breadcrumb">
          학습 관리 <ChevronRight :size="14" /><span>{{
            page === 'students' ? '학생 관리' : page === 'mine' ? '내 방문 신청' : '자습실 관리'
          }}</span>
        </div>
      </header>
      <main id="main-content" :inert="!!modal">
        <div v-if="error" class="alert" role="alert">
          {{ error }} <button @click="load">다시 불러오기</button>
        </div>
        <div v-if="role === 'student' && !loading && !students.length" class="alert" role="status">
          등록된 학생이 없습니다. 강사 모드에서 학생을 먼저 등록해 주세요.
          <button @click="leaveWorkspace">처음 화면으로</button>
        </div>
        <div v-if="notice" class="toast" role="status"><CheckCircle2 :size="18" />{{ notice }}</div>
        <RoomDetail
          v-if="selected && page === 'rooms'"
          :selected="selected"
          :role="role"
          :loading="loading"
          :current-student="currentStudent"
          :own-visit="myActive.find((v) => v.roomId === selected?.id)"
          @back="navigate('rooms')"
          @edit="dialog?.editRoom"
          @delete="dialog?.deleteRoom"
          @book="book"
        />
        <template v-else>
          <div class="page-heading">
            <div>
              <p class="eyebrow">
                {{
                  page === 'rooms'
                    ? role === 'teacher'
                      ? '강사 워크스페이스'
                      : '학생 워크스페이스'
                    : page === 'students'
                      ? '학생 정보'
                      : '나의 학습 일정'
                }}
              </p>
              <h1>
                {{
                  page === 'rooms'
                    ? role === 'teacher'
                      ? '자습실 운영'
                      : '어디서 공부할까요?'
                    : page === 'students'
                      ? '학생 관리'
                      : '나의 방문 신청'
                }}
              </h1>
              <p>
                {{
                  page === 'rooms'
                    ? role === 'teacher'
                      ? '운영 일정부터 방문 신청까지, 한곳에서 관리하세요.'
                      : '자습실을 고르고, 나에게 맞는 방문 시간을 신청하세요.'
                    : page === 'students'
                      ? '학생 정보와 연락처를 한곳에서 관리하세요.'
                      : '예정된 자습 시간을 확인하고 나만의 계획을 세워보세요.'
                }}
              </p>
            </div>
            <button
              v-if="role === 'teacher'"
              class="primary"
              @click="page === 'students' ? dialog?.editStudent() : dialog?.editRoom()"
            >
              <Plus :size="18" /> {{ page === 'students' ? '학생 등록' : '자습실 만들기' }}
            </button>
          </div>
          <RoomList
            v-if="page === 'rooms'"
            :rooms="rooms"
            :visits="visits"
            :role="role"
            :loading="loading"
            :current-student="currentStudent"
            @create="dialog?.editRoom()"
            @detail="detail"
            @book="book"
          />
          <StudentList
            v-else-if="page === 'students'"
            :students="students"
            @edit="dialog?.editStudent"
            @delete="dialog?.deleteStudent"
          />
          <MyVisits
            v-else
            :visits="visits"
            @browse="navigate('rooms')"
            @book="book"
            @cancel="dialog?.cancelVisit"
          />
        </template>
        <footer>
          <span>시대인재 · 자습실</span>
          <small>모든 일시는 한국 시간(KST) 기준입니다.</small>
        </footer>
      </main>
    </div>
  </div>
  <WorkspaceDialog ref="dialog" :workspace="workspace" @saved="saved" />
</template>
