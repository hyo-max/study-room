<script setup lang="ts">
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  DoorOpen,
  Users,
  Pencil,
  Trash2,
  History,
  ArrowLeft,
} from 'lucide-vue-next';
import type { Room, RoomDetail, Student, Visit, Role } from '../types';
import { fmt } from '../date-time';
defineProps<{
  selected: RoomDetail;
  role: Role;
  loading: boolean;
  currentStudent?: Student;
  ownVisit?: Visit;
}>();
const emit = defineEmits<{
  back: [];
  edit: [room: Room];
  delete: [room: Room];
  book: [room: Room, visit?: Visit];
}>();
const label: Record<string, string> = {
  APPLIED: '방문 신청',
  CHANGED: '시간 변경',
  CANCELLED: '신청 취소',
  REAPPLIED: '재신청',
};
</script>
<template>
  <button class="back" @click="emit('back')"><ArrowLeft :size="16" /> 자습실 목록</button>
  <div class="page-heading">
    <div>
      <p class="eyebrow">자습실 상세</p>
      <h1>{{ selected.name }}</h1>
      <p>운영 정보와 방문 현황을 한눈에 확인하세요.</p>
    </div>
    <div v-if="role === 'teacher'" class="actions">
      <button class="secondary" @click="emit('edit', selected)"><Pencil :size="16" /> 수정</button
      ><button class="danger outline" @click="emit('delete', selected)">
        <Trash2 :size="16" /> 삭제
      </button>
    </div>
    <button
      v-else
      class="primary"
      :disabled="
        loading || !currentStudent || (!ownVisit && selected.count >= selected.maxPersonnel)
      "
      @click="emit('book', selected, ownVisit)"
    >
      {{ ownVisit ? '방문 시간 변경' : '방문 신청' }}<ArrowUpRight :size="16" />
    </button>
  </div>
  <div class="detail-overview">
    <div>
      <CalendarDays :size="20" /><small>운영 기간 · 한국 시간</small
      ><strong>{{ fmt(selected.startDate) }} — {{ fmt(selected.endDate) }}</strong>
    </div>
    <div>
      <Users :size="20" /><small>신청 현황</small
      ><strong
        >{{ selected.count }}명 <span>/ {{ selected.maxPersonnel }}명</span></strong
      >
    </div>
    <div>
      <DoorOpen :size="20" /><small>남은 자리</small
      ><strong>{{ selected.maxPersonnel - selected.count }}석</strong>
    </div>
  </div>
  <template v-if="role === 'teacher'">
    <section class="panel">
      <div class="section-head">
        <h2>
          방문 예정 학생 <span>{{ selected.visits.length }}</span>
        </h2>
        <small>신청 기준</small>
      </div>
      <div class="table-scroll">
        <table v-if="selected.visits.length">
          <thead>
            <tr>
              <th>학생</th>
              <th>방문 예정 일시</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in selected.visits" :key="v.id">
              <td>
                <span class="table-avatar">{{ v.studentName?.[0] }}</span
                >{{ v.studentName }}
              </td>
              <td>{{ fmt(v.visitAt) }}</td>
              <td><span class="badge green">신청 완료</span></td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">
          <Users :size="28" /><strong>아직 신청한 학생이 없어요</strong>
          <p>학생이 방문을 신청하면 여기에 표시됩니다.</p>
        </div>
      </div>
    </section>
    <section class="panel">
      <div class="section-head">
        <h2>
          신청 이력 <span>{{ selected.history.length }}</span>
        </h2>
        <small>발생 순 · 한국 시간</small>
      </div>
      <div v-if="selected.history.length" class="timeline">
        <div v-for="h in selected.history" :key="h.id" class="event">
          <span class="event-icon" :class="{ cancelled: h.action === 'CANCELLED' }"
            ><History :size="16"
          /></span>
          <div>
            <strong
              >{{ h.studentName }} <span>{{ label[h.action] }}</span></strong
            >
            <p>
              {{ h.before ? fmt(h.before) : '신규 신청' }} →
              {{ h.after ? fmt(h.after) : '취소' }}
            </p>
            <small v-if="h.reason">{{ h.reason }} · {{ h.actor }}</small>
          </div>
          <time>{{ fmt(h.createdAt) }}</time>
        </div>
      </div>
      <div v-else class="empty">
        <History :size="28" /><strong>첫 신청을 기다리고 있어요</strong>
        <p>신청·변경·취소 이력이 이곳에 차곡차곡 쌓입니다.</p>
      </div>
    </section>
  </template>
  <section v-else class="panel student-guide">
    <BookOpen :size="28" />
    <h2>방문 전 확인해 주세요.</h2>
    <p>
      운영 기간 안에서 방문할 시간을 선택해 주세요.<br />신청한 시간은 내 방문 신청에서 변경할 수
      있습니다.
    </p>
    <span class="badge green" v-if="ownVisit">내 방문 예정 · {{ fmt(ownVisit!.visitAt) }}</span>
  </section>
</template>
