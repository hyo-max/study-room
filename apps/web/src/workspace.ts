import { computed, ref, watch } from 'vue';
import type { Room, RoomDetail, Student, Visit, Role, Page } from './types';
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
/** Keep asynchronous reads tied to the selected actor and current detail view. */
export function createWorkspace(fetcher: typeof fetch = fetch) {
  const role = ref<Role>('teacher');
  const studentId = ref(1);
  const page = ref<Page>('rooms');
  const rooms = ref<Room[]>([]);
  const students = ref<Student[]>([]);
  const visits = ref<Visit[]>([]);
  const selected = ref<RoomDetail | null>(null);
  const loading = ref(false);
  const error = ref('');
  const currentStudent = computed(() => students.value.find((s) => s.id === studentId.value));
  let loadVersion = 0;
  let detailVersion = 0;
  const actor = () => ({ role: role.value, studentId: studentId.value });
  const sameActor = (a: ReturnType<typeof actor>) =>
    a.role === role.value && a.studentId === studentId.value;
  async function api<T = unknown>(
    path: string,
    method = 'GET',
    body?: unknown,
    identity = actor(),
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetcher(`/api${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-role': identity.role,
          'x-student-id': String(identity.studentId),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new ApiError('서버에 연결할 수 없습니다. 연결 상태를 확인하고 다시 시도해 주세요.', 0);
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(
        '서버 응답을 읽을 수 없습니다. 잠시 후 다시 시도해 주세요.',
        response.status,
      );
    }
    if (!response.ok) {
      const message =
        typeof data === 'object' &&
        data !== null &&
        'message' in data &&
        typeof data.message === 'string'
          ? data.message
          : '요청을 처리하지 못했습니다.';
      throw new ApiError(message, response.status);
    }
    // Successful responses follow our own server's contract; untrusted error payloads are narrowed above.
    return data as T;
  }
  async function load() {
    const version = ++loadVersion;
    const identity = actor();
    const detailId = selected.value?.id;
    const detailRequest = detailVersion;
    const isCurrent = () => version === loadVersion && sameActor(identity);
    loading.value = true;
    error.value = '';
    try {
      const [r, s] = await Promise.all([
        api<Room[]>('/rooms', 'GET', undefined, identity),
        api<Student[]>('/students', 'GET', undefined, identity),
      ]);
      if (!isCurrent()) return;
      rooms.value = r;
      students.value = s;
      if (
        identity.role === 'student' &&
        !s.some((student: Student) => student.id === identity.studentId)
      ) {
        visits.value = [];
        if (s.length) studentId.value = s[0].id; // The synchronous watcher starts a fresh read for the valid actor.
        return;
      }
      const v =
        identity.role === 'student'
          ? await api<Visit[]>('/visits/mine', 'GET', undefined, identity)
          : [];
      if (!isCurrent()) return;
      visits.value = v;
      if (detailId && detailRequest === detailVersion && selected.value?.id === detailId) {
        try {
          const result = await api<RoomDetail>(`/rooms/${detailId}`, 'GET', undefined, identity);
          if (isCurrent() && detailRequest === detailVersion && selected.value?.id === detailId)
            selected.value = result;
        } catch (e) {
          if (!isCurrent() || detailRequest !== detailVersion || selected.value?.id !== detailId)
            return;
          if (e instanceof ApiError && e.status === 404) selected.value = null;
          else throw e;
        }
      }
    } catch (e) {
      if (isCurrent()) error.value = e instanceof Error ? e.message : '목록을 불러오지 못했습니다.';
    } finally {
      if (isCurrent()) loading.value = false;
    }
  }
  async function detail(room: Room) {
    const version = ++detailVersion;
    const identity = actor();
    error.value = '';
    try {
      const result = await api<RoomDetail>(`/rooms/${room.id}`, 'GET', undefined, identity);
      if (version === detailVersion && sameActor(identity) && page.value === 'rooms')
        selected.value = result;
    } catch (e) {
      if (version === detailVersion && sameActor(identity))
        error.value = e instanceof Error ? e.message : '상세를 불러오지 못했습니다.';
    }
  }
  function navigate(to: Page) {
    detailVersion++;
    page.value = to;
    selected.value = null;
  }
  watch(
    [role, studentId],
    () => {
      detailVersion++;
      selected.value = null;
      visits.value = [];
      page.value = 'rooms';
      void load();
    },
    { flush: 'sync' },
  );
  return {
    role,
    studentId,
    page,
    rooms,
    students,
    visits,
    selected,
    loading,
    error,
    currentStudent,
    api,
    load,
    detail,
    navigate,
  };
}

export type Workspace = ReturnType<typeof createWorkspace>;
