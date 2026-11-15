<script setup lang="ts">
import { BookOpen, Check, X } from 'lucide-vue-next';
import { computed, nextTick, ref, watch } from 'vue';
import type { Room, Student, Visit } from '../types';
import type { Workspace } from '../workspace';
import { fmt, inputDate, iso } from '../date-time';
const { workspace } = defineProps<{ workspace: Workspace }>();
const { api, load, rooms, selected } = workspace;
const emit = defineEmits<{ saved: [] }>();
const busy = ref(false);
const modal = ref<'' | 'room' | 'student' | 'visit' | 'confirm'>('');
const modalError = ref('');
const modalRoot = ref<HTMLElement>();
let focusBefore: HTMLElement | null = null;
const roomForm = ref({ id: 0, name: '', maxPersonnel: 12, startDate: '', endDate: '' });
const studentForm = ref({ id: 0, name: '', phone: '' });
const visitForm = ref({ id: 0, roomId: 0, visitAt: '' });
const confirmAction = ref<null | (() => Promise<void>)>(null);
const confirmTitle = ref('');
const confirmDescription = ref('');
async function open(kind: Exclude<typeof modal.value, ''>) {
  focusBefore = document.activeElement as HTMLElement;
  modalError.value = '';
  modal.value = kind;
  await nextTick();
  modalRoot.value?.querySelector<HTMLElement>('input, button')?.focus();
}
function close() {
  if (busy.value) return;
  modal.value = '';
  nextTick(() => focusBefore?.focus());
}
function trap(event: KeyboardEvent) {
  if (event.key === 'Escape') close();
  if (event.key !== 'Tab') return;
  const nodes = modalRoot.value?.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input, select, [tabindex="0"]',
  );
  if (!nodes?.length) return;
  const first = nodes[0],
    last = nodes[nodes.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
function editRoom(r?: Room) {
  const defaultStart = new Date(Date.now() + 86400000);
  defaultStart.setUTCSeconds(0, 0);
  const start = defaultStart.toISOString();
  roomForm.value = r
    ? {
        id: r.id,
        name: r.name,
        maxPersonnel: r.maxPersonnel,
        startDate: inputDate(r.startDate),
        endDate: inputDate(r.endDate),
      }
    : {
        id: 0,
        name: '',
        maxPersonnel: 12,
        startDate: inputDate(start),
        endDate: inputDate(new Date(Date.parse(start) + 4 * 3600000).toISOString()),
      };
  open('room');
}
function editStudent(s?: Student) {
  studentForm.value = s ? { ...s } : { id: 0, name: '', phone: '' };
  open('student');
}
function book(r: Room, v?: Visit) {
  visitForm.value = { id: v?.id || 0, roomId: r.id, visitAt: inputDate(v?.visitAt || r.startDate) };
  open('visit');
}
function confirm(title: string, description: string, fn: () => Promise<void>) {
  confirmTitle.value = title;
  confirmDescription.value = description;
  confirmAction.value = fn;
  open('confirm');
}
function deleteRoom(r: Room) {
  confirm(
    '자습실을 삭제할까요?',
    '기존 신청은 자동 취소되고 이력은 보존됩니다. 목록에서는 더 이상 보이지 않습니다.',
    async () => {
      await api(`/rooms/${r.id}`, 'DELETE');
      selected.value = null;
    },
  );
}
function cancelVisit(v: Visit) {
  confirm(
    '방문 신청을 취소할까요?',
    '취소하면 다른 학생이 신청할 수 있습니다. 자리가 남아 있으면 다시 신청할 수 있어요.',
    async () => {
      await api(`/visits/${v.id}`, 'DELETE');
    },
  );
}
async function submit() {
  if (busy.value) return;
  busy.value = true;
  modalError.value = '';
  try {
    if (modal.value === 'room') {
      const f = roomForm.value;
      await api(`/rooms${f.id ? `/${f.id}` : ''}`, f.id ? 'PATCH' : 'POST', {
        name: f.name,
        maxPersonnel: Number(f.maxPersonnel),
        startDate: iso(f.startDate),
        endDate: iso(f.endDate),
      });
    }
    if (modal.value === 'student') {
      const f = studentForm.value;
      await api(`/students${f.id ? `/${f.id}` : ''}`, f.id ? 'PATCH' : 'POST', {
        name: f.name,
        phone: f.phone,
      });
    }
    if (modal.value === 'visit') {
      const f = visitForm.value;
      await api(f.id ? `/visits/${f.id}` : `/rooms/${f.roomId}/visits`, f.id ? 'PATCH' : 'POST', {
        visitAt: iso(f.visitAt),
      });
    }
    if (modal.value === 'confirm') await confirmAction.value?.();
    busy.value = false;
    close();
    emit('saved');
    await load();
  } catch (e: unknown) {
    modalError.value = e instanceof Error ? e.message : '저장하지 못했습니다. 다시 시도해 주세요.';
  } finally {
    busy.value = false;
  }
}
function deleteStudent(s: Student) {
  confirm(
    '학생을 삭제할까요?',
    '활성 신청이 있으면 삭제할 수 없습니다. 삭제해도 이전 신청 이력은 보존됩니다.',
    async () => {
      await api(`/students/${s.id}`, 'DELETE');
    },
  );
}
const isOpen = computed(() => !!modal.value);
watch([workspace.role, workspace.studentId], close);
defineExpose({
  editRoom,
  editStudent,
  book,
  deleteRoom,
  deleteStudent,
  cancelVisit,
  busy,
  isOpen,
  close,
});
</script>
<template>
  <div v-if="modal" class="modal-backdrop" @click.self="close" @keydown="trap">
    <section
      ref="modalRoot"
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div class="modal-heading">
        <div>
          <p class="eyebrow">{{ modal === 'confirm' ? '변경 확인' : '시대인재 자습실' }}</p>
          <h2 id="modal-title">
            {{
              modal === 'room'
                ? roomForm.id
                  ? '자습실 수정'
                  : '새로운 자습실'
                : modal === 'student'
                  ? studentForm.id
                    ? '학생 정보 수정'
                    : '학생 등록'
                  : modal === 'visit'
                    ? visitForm.id
                      ? '방문 시간 변경'
                      : '방문 신청'
                    : confirmTitle
            }}
          </h2>
        </div>
        <button class="icon-button" aria-label="닫기" :disabled="busy" @click="close">
          <X :size="20" />
        </button>
      </div>
      <form @submit.prevent="submit">
        <template v-if="modal === 'room'"
          ><label
            >자습실 이름<input
              v-model="roomForm.name"
              required
              maxlength="80"
              placeholder="예: 몰입의 공간" /></label
          ><label
            >최대 인원<input
              v-model="roomForm.maxPersonnel"
              required
              type="number"
              min="1"
              step="1" /></label
          ><label
            >운영 시작 · KST<input
              v-model="roomForm.startDate"
              required
              type="datetime-local"
              step="0.001" /></label
          ><label
            >운영 종료 · KST<input
              v-model="roomForm.endDate"
              required
              type="datetime-local"
              step="0.001"
          /></label>
          <p class="form-note">
            기존 신청 인원과 방문 시간을 유지할 수 있는 범위에서 수정할 수 있어요.
          </p></template
        ><template v-else-if="modal === 'student'"
          ><label
            >학생 이름<input
              v-model="studentForm.name"
              required
              maxlength="40"
              placeholder="이름을 입력하세요" /></label
          ><label
            >연락처<input
              v-model="studentForm.phone"
              type="tel"
              required
              maxlength="20"
              placeholder="010-1234-5678" /></label></template
        ><template v-else-if="modal === 'visit'"
          ><div class="booking-info">
            <BookOpen :size="22" />
            <div>
              <strong>{{ rooms.find((r) => r.id === visitForm.roomId)?.name }}</strong>
              <p>
                {{ fmt(rooms.find((r) => r.id === visitForm.roomId)!.startDate) }} —
                {{ fmt(rooms.find((r) => r.id === visitForm.roomId)!.endDate) }}
              </p>
            </div>
          </div>
          <label
            >방문 예정 일시 · KST<input
              v-model="visitForm.visitAt"
              required
              type="datetime-local"
              step="0.001"
              :min="inputDate(rooms.find((r) => r.id === visitForm.roomId)!.startDate)"
              :max="inputDate(rooms.find((r) => r.id === visitForm.roomId)!.endDate)"
          /></label>
          <p class="form-note">
            운영 기간 안에서 시간을 선택해 주세요. 한 자습실에는 한 건만 신청할 수 있어요.
          </p></template
        >
        <p v-else class="confirm-description">{{ confirmDescription }}</p>
        <div v-if="modalError" class="alert" role="alert">{{ modalError }}</div>
        <div class="modal-actions">
          <button class="secondary" type="button" :disabled="busy" @click="close">돌아가기</button
          ><button
            :class="modal === 'confirm' ? 'danger solid' : 'primary'"
            :disabled="busy"
            type="submit"
          >
            {{
              busy
                ? '저장 중…'
                : modal === 'confirm'
                  ? '확인'
                  : modal === 'visit'
                    ? '신청 저장'
                    : '저장하기'
            }}<Check v-if="!busy" :size="16" />
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
