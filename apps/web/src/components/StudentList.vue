<script setup lang="ts">
import { Search, Users, Pencil, Trash2 } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import type { Student } from '../types';
const props = defineProps<{ students: Student[] }>();
const emit = defineEmits<{ edit: [student: Student]; delete: [student: Student] }>();
const search = ref('');
const filteredStudents = computed(() =>
  props.students.filter((s) => `${s.name} ${s.phone}`.includes(search.value)),
);
</script>
<template>
  <div class="toolbar">
    <h2>
      전체 학생 <span>{{ students.length }}</span>
    </h2>
    <label class="search"
      ><Search :size="16" /><input
        v-model="search"
        aria-label="학생 검색"
        placeholder="이름 또는 연락처 검색"
    /></label>
  </div>
  <div class="panel table-scroll">
    <table v-if="filteredStudents.length">
      <thead>
        <tr>
          <th>학생 이름</th>
          <th>연락처</th>
          <th>학생 번호</th>
          <th>관리</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in filteredStudents" :key="s.id">
          <td>
            <span class="table-avatar">{{ s.name[0] }}</span
            ><strong>{{ s.name }}</strong>
          </td>
          <td>{{ s.phone }}</td>
          <td class="muted">ST-{{ String(s.id).padStart(3, '0') }}</td>
          <td>
            <div class="actions">
              <button class="icon-button" :aria-label="`${s.name} 수정`" @click="emit('edit', s)">
                <Pencil :size="16" /></button
              ><button
                class="icon-button"
                :aria-label="`${s.name} 삭제`"
                @click="emit('delete', s)"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty"><Users :size="28" /><strong>표시할 학생이 없어요</strong></div>
  </div>
</template>
