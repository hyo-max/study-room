<script setup lang="ts">
import { BookOpen, CalendarDays } from 'lucide-vue-next';
import type { Room, Visit } from '../types';
import { fmt } from '../date-time';
defineProps<{ visits: Visit[] }>();
const emit = defineEmits<{
  browse: [];
  book: [room: Room, visit: Visit];
  cancel: [visit: Visit];
}>();
</script>
<template>
  <section class="panel">
    <div class="section-head">
      <h2>
        전체 신청 <span>{{ visits.length }}</span>
      </h2>
      <small>취소된 신청도 확인할 수 있어요</small>
    </div>
    <div v-if="!visits.length" class="empty">
      <CalendarDays :size="30" /><strong>아직 신청한 자습실이 없어요</strong>
      <p>나에게 맞는 시간을 찾아 첫 방문을 신청해 보세요.</p>
      <button class="primary" @click="emit('browse')">자습실 둘러보기</button>
    </div>
    <div v-for="v in visits" :key="v.id" class="my-visit">
      <span class="room-symbol"><BookOpen :size="23" /></span>
      <div>
        <h3>{{ v.room?.name }} <small v-if="v.room?.deletedAt">삭제된 자습실</small></h3>
        <p>{{ fmt(v.visitAt) }}</p>
      </div>
      <span class="badge" :class="v.status === 'ACTIVE' ? 'green' : 'gray'">{{
        v.status === 'ACTIVE' ? '신청 완료' : '취소됨'
      }}</span>
      <div v-if="v.status === 'ACTIVE'" class="actions">
        <button class="secondary" @click="v.room && emit('book', v.room, v)">시간 변경</button
        ><button class="text-button danger" @click="emit('cancel', v)">취소</button>
      </div>
    </div>
  </section>
</template>
