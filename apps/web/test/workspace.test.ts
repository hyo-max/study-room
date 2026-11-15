import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { effectScope } from 'vue';
import { createWorkspace } from '../src/workspace';
const room = {
  id: 1,
  name: '테스트',
  maxPersonnel: 2,
  count: 0,
  startDate: '2026-12-01T00:00:30.125Z',
  endDate: '2026-12-01T12:00:30.125Z',
  deletedAt: null,
};
const roomDetail = { ...room, history: [], visits: [] };
const students = [
  { id: 1, name: '학생1', phone: '010-0000-0001' },
  { id: 2, name: '학생2', phone: '010-0000-0002' },
];
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
async function flush() {
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
}
function setup(t: TestContext, fetcher: typeof fetch) {
  const scope = effectScope();
  t.after(() => scope.stop());
  return scope.run(() => createWorkspace(fetcher))!;
}
function base(url: string) {
  if (url === '/api/rooms') return response([room]);
  if (url === '/api/students') return response(students);
  if (url === '/api/visits/mine') return response([]);
  return response(roomDetail);
}

test('선택한 학생이 삭제되면 실제 존재하는 학생으로 전환하고 신청 목록을 읽는다', async (t) => {
  const mineIds: string[] = [];
  const w = setup(t, async (url, options) => {
    if (url === '/api/students') return response([students[1]]);
    if (url === '/api/visits/mine') {
      mineIds.push(new Headers(options?.headers).get('x-student-id')!);
      return response([]);
    }
    return base(String(url));
  });
  w.role.value = 'student';
  await flush();
  assert.equal(w.studentId.value, 2);
  assert.deepEqual(mineIds, ['2']);
  assert.equal(w.error.value, '');
  assert.equal(w.loading.value, false);
});
test('학생이 0명이면 잘못된 내 신청 요청 없이 목록을 보여준다', async (t) => {
  let mineCalls = 0;
  const w = setup(t, async (url) => {
    if (url === '/api/students') return response([]);
    if (url === '/api/visits/mine') mineCalls++;
    return base(String(url));
  });
  w.role.value = 'student';
  await flush();
  assert.equal(mineCalls, 0);
  assert.equal(w.currentStudent.value, undefined);
  assert.equal(w.rooms.value.length, 1);
  assert.equal(w.error.value, '');
  assert.equal(w.loading.value, false);
});
test('학생을 바꾼 뒤 늦게 도착한 이전 학생의 신청 목록을 무시한다', async (t) => {
  const late = deferred<Response>();
  const w = setup(t, async (url, options) => {
    if (url === '/api/visits/mine')
      return new Headers(options?.headers).get('x-student-id') === '1'
        ? late.promise
        : response([{ id: 22, studentId: 2 }]);
    return base(String(url));
  });
  w.role.value = 'student';
  await flush();
  w.studentId.value = 2;
  await flush();
  late.resolve(response([{ id: 11, studentId: 1 }]));
  await flush();
  assert.equal(w.visits.value[0].studentId, 2);
  assert.equal(w.loading.value, false);
});
test('상세 응답이 늦게 도착해도 다른 메뉴로 이동한 뒤 다시 열리지 않는다', async (t) => {
  const late = deferred<Response>();
  const w = setup(t, async (url) => (url === '/api/rooms/1' ? late.promise : base(String(url))));
  const pending = w.detail(room);
  w.navigate('students');
  late.resolve(response(roomDetail));
  await pending;
  assert.equal(w.selected.value, null);
  assert.equal(w.page.value, 'students');
});
test('강사 상세 갱신 중 학생으로 전환하면 이전 상세를 복원하지 않는다', async (t) => {
  const late = deferred<Response>();
  const w = setup(t, async (url) => (url === '/api/rooms/1' ? late.promise : base(String(url))));
  w.selected.value = roomDetail;
  const pending = w.load();
  await flush();
  w.role.value = 'student';
  await flush();
  late.resolve(response(roomDetail));
  await pending;
  assert.equal(w.selected.value, null);
  assert.equal(w.role.value, 'student');
});
test('열어 둔 자습실이 다른 창에서 삭제되면 재조회 시 상세를 닫는다', async (t) => {
  const w = setup(t, async (url) =>
    url === '/api/rooms/1' ? response({ message: '삭제됨' }, 404) : base(String(url)),
  );
  w.selected.value = roomDetail;
  await w.load();
  assert.equal(w.selected.value, null);
  assert.equal(w.error.value, '');
});
test('빠르게 두 자습실을 열면 마지막으로 선택한 상세만 표시한다', async (t) => {
  const late = deferred<Response>();
  const w = setup(t, async (url) =>
    url === '/api/rooms/1' ? late.promise : response({ ...roomDetail, id: 2 }),
  );
  const pending = w.detail(room);
  await w.detail({ ...room, id: 2 });
  late.resolve(response(roomDetail));
  await pending;
  assert.equal(w.selected.value?.id, 2);
});
test('서버 중단 후 재시도하면 오류와 로딩 상태가 복구된다', async (t) => {
  let broken = true;
  const w = setup(t, async (url) => {
    if (broken) throw new Error('offline');
    return base(String(url));
  });
  await w.load();
  assert.match(w.error.value, /서버에 연결/);
  assert.equal(w.loading.value, false);
  broken = false;
  await w.load();
  assert.equal(w.error.value, '');
  assert.equal(w.rooms.value.length, 1);
});

test('오류 응답이 null·문자열·객체 메시지여도 사용자에게 안전한 오류를 표시한다', async (t) => {
  for (const payload of [null, 'error', { message: { detail: 'invalid' } }]) {
    const w = setup(t, async () => response(payload, 400));
    await w.load();
    assert.equal(w.error.value, '요청을 처리하지 못했습니다.');
    assert.equal(w.loading.value, false);
  }
});
