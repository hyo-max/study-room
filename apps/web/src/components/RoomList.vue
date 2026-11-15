<script setup lang="ts">
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  DoorOpen,
  LayoutGrid,
  Plus,
  Search,
  Users,
} from 'lucide-vue-next';
import { computed, ref } from 'vue';
import type { Room, Student, Visit, Role } from '../types';
import { fmt, time } from '../date-time';
const props = defineProps<{
  rooms: Room[];
  visits: Visit[];
  role: Role;
  loading: boolean;
  currentStudent?: Student;
}>();
const emit = defineEmits<{ create: []; detail: [room: Room]; book: [room: Room, visit?: Visit] }>();
const search = ref('');
const filter = ref<'all' | 'available'>('all');
const filteredRooms = computed(() =>
  props.rooms.filter(
    (r) =>
      r.name.includes(search.value) && (filter.value !== 'available' || r.count < r.maxPersonnel),
  ),
);
const activeCount = computed(() => props.rooms.reduce((n, r) => n + r.count, 0));
const availableCount = computed(() =>
  props.rooms.reduce((n, r) => n + r.maxPersonnel - r.count, 0),
);
const today = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
}).format(new Date());
function own(room: Room) {
  return props.visits.find((v) => v.roomId === room.id && v.status === 'ACTIVE');
}
</script>
<template>
  <section class="summary-grid" aria-label="운영 요약">
    <div class="summary-card">
      <div class="summary-label">운영 자습실 <LayoutGrid :size="18" /></div>
      <div class="summary-number">{{ rooms.length }}<span>개</span></div>
      <p><span class="dot"></span>등록된 전체 자습실</p>
    </div>
    <div class="summary-card">
      <div class="summary-label">전체 방문 신청 <Users :size="18" /></div>
      <div class="summary-number">{{ activeCount }}<span>명</span></div>
      <p>취소를 제외한 신청 인원</p>
    </div>
    <div class="summary-card">
      <div class="summary-label">신청 가능한 자리 <DoorOpen :size="18" /></div>
      <div class="summary-number">{{ availableCount }}<span>석</span></div>
      <p>전체 정원 중 신청 가능한 자리</p>
    </div>
  </section>
  <div class="section-title">
    <h2>
      자습실 목록 <span>{{ rooms.length }}</span>
    </h2>
    <span class="date-label"><CalendarDays :size="14" />{{ today }}</span>
  </div>
  <div class="toolbar">
    <div class="tabs">
      <button :class="{ selected: filter === 'all' }" @click="filter = 'all'">전체 자습실</button
      ><button :class="{ selected: filter === 'available' }" @click="filter = 'available'">
        신청 가능
      </button>
    </div>
    <label class="search"
      ><Search :size="16" /><input
        v-model="search"
        placeholder="자습실 이름 검색"
        aria-label="자습실 검색"
    /></label>
  </div>
  <div v-if="loading && !rooms.length" class="empty" role="status">자습실을 불러오는 중입니다…</div>
  <div v-else-if="!filteredRooms.length" class="empty panel">
    <BookOpen :size="30" /><strong>{{
      rooms.length ? '검색 결과가 없어요' : '첫 자습실을 열어보세요'
    }}</strong>
    <p>
      {{
        rooms.length
          ? '다른 이름이나 필터로 찾아보세요.'
          : '자습실을 만들면 학생들이 방문을 신청할 수 있어요.'
      }}
    </p>
    <button v-if="!rooms.length && role === 'teacher'" class="primary" @click="emit('create')">
      자습실 만들기
    </button>
  </div>
  <div v-else class="room-grid">
    <article v-for="r in filteredRooms" :key="r.id" class="room-card">
      <div class="room-identity">
        <span class="room-number">{{ String(r.id).padStart(2, '0') }}</span>
        <div>
          <span class="badge" :class="r.count < r.maxPersonnel ? 'green' : 'gray'"
            ><span class="dot"></span
            >{{ r.count < r.maxPersonnel ? '신청 가능' : '정원 마감' }}</span
          >
          <button class="room-title" @click="emit('detail', r)">
            {{ r.name }}<ArrowUpRight :size="20" />
          </button>
          <p class="room-id">최대 {{ r.maxPersonnel }}명 · 자습 전용</p>
        </div>
      </div>
      <div class="room-schedule">
        <span class="field-label">운영 일정</span>
        <div class="room-period">
          <CalendarDays :size="16" /><span
            >{{ fmt(r.startDate, true) }} — {{ fmt(r.endDate, true) }}</span
          >
        </div>
        <div class="room-period time-row">
          <Clock3 :size="16" /><span>{{ time(r.startDate) }} — {{ time(r.endDate) }}</span>
        </div>
      </div>
      <div class="capacity">
        <div>
          <span class="field-label">신청 인원</span
          ><strong
            >{{ r.count }}<span> / {{ r.maxPersonnel }}</span></strong
          >
        </div>
        <div
          class="progress"
          role="meter"
          :aria-valuenow="r.count"
          :aria-valuemax="r.maxPersonnel"
          :aria-valuemin="0"
          :aria-label="`${r.name} 신청 인원`"
        >
          <i :style="{ width: `${(r.count / r.maxPersonnel) * 100}%` }"></i>
        </div>
        <p>
          <strong>{{ r.maxPersonnel - r.count }}석</strong> 신청 가능
        </p>
      </div>
      <div class="room-bottom">
        <button
          v-if="role === 'student'"
          class="book-small"
          :disabled="loading || !currentStudent || (!own(r) && r.count >= r.maxPersonnel)"
          @click="emit('book', r, own(r))"
        >
          {{ own(r) ? '시간 변경' : '방문 신청' }}<Plus :size="16" />
        </button>
        <button class="text-button" @click="emit('detail', r)">
          {{ role === 'teacher' ? '상세 보기' : '운영 정보' }}<ChevronRight :size="16" />
        </button>
      </div>
    </article>
  </div>
  <div class="info-strip">
    <span class="info-icon"><Check :size="16" /></span>
    <p>신청부터 변경, 취소까지 모든 방문 이력이 자동으로 기록됩니다.</p>
    <span>방문 이력 자동 저장</span>
  </div>
</template>
