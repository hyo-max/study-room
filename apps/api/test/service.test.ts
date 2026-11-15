import 'reflect-metadata';
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Actor, Service } from '../src/service';
import { Store } from '../src/store';
const teacher: Actor = { role: 'teacher' };
const student = (id = 1): Actor => ({ role: 'student', studentId: id });
const fields = {
  name: '테스트 자습실',
  maxPersonnel: 2,
  startDate: '2026-12-01T09:00:00+09:00',
  endDate: '2026-12-01T21:00:00+09:00',
};
const at = { visitAt: '2026-12-01T10:00:00+09:00' };
function setup(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'study-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'store.json');
  const store = new Store(file);
  const svc = new Service(store);
  const room = svc.saveRoom(null, fields, teacher);
  return { svc, room, store, file };
}
test('정상 신청과 생성 이력을 함께 저장한다', (t) => {
  const { svc, room } = setup(t);
  const v = svc.apply(room.id, at, student());
  assert.equal(v.status, 'ACTIVE');
  const d = svc.detail(room.id, teacher);
  assert.equal(d.count, 1);
  assert.equal(d.history[0].action, 'APPLIED');
});
test('중복 신청은 거절하고 이력과 인원을 변경하지 않는다', (t) => {
  const { svc, room } = setup(t);
  svc.apply(room.id, at, student());
  assert.throws(() => svc.apply(room.id, at, student()), /이미 신청/);
  assert.equal(svc.detail(room.id, teacher).history.length, 1);
});
test('정원 초과를 거절한다', (t) => {
  const { svc, room } = setup(t);
  svc.apply(room.id, at, student());
  svc.apply(room.id, at, student(2));
  assert.throws(() => svc.apply(room.id, at, student(3)), /정원/);
});
test('취소는 정원을 복원하며 재신청은 동일한 ID를 사용한다', (t) => {
  const { svc, room } = setup(t);
  const v = svc.apply(room.id, at, student());
  svc.changeVisit(v.id, {}, student(), true);
  assert.equal(svc.detail(room.id, teacher).count, 0);
  assert.equal(svc.apply(room.id, at, student()).id, v.id);
  assert.deepEqual(
    svc.detail(room.id, teacher).history.map((h) => h.action),
    ['APPLIED', 'CANCELLED', 'REAPPLIED'],
  );
});
test('시간 변경 이력에 변경 전후 값을 보존한다', (t) => {
  const { svc, room } = setup(t);
  const v = svc.apply(room.id, at, student());
  const result = svc.changeVisit(v.id, { visitAt: fields.endDate }, student());
  const event = svc.detail(room.id, teacher).history[1];
  assert.equal(event.before, v.visitAt);
  assert.equal(event.after, result.visitAt);
});
test('타인의 신청 수정과 취소를 거절한다', (t) => {
  const { svc, room } = setup(t);
  const v = svc.apply(room.id, at, student());
  assert.throws(() => svc.changeVisit(v.id, at, student(2)), /본인/);
  assert.throws(() => svc.changeVisit(v.id, {}, student(2), true), /본인/);
});
test('시작과 종료 경계 시각은 포함한다', (t) => {
  const { svc, room } = setup(t);
  svc.apply(room.id, { visitAt: fields.startDate }, student());
  svc.apply(room.id, { visitAt: fields.endDate }, student(2));
  assert.equal(svc.detail(room.id, teacher).count, 2);
});
test('기간 밖 신청과 잘못된 일시를 거절한다', (t) => {
  const { svc, room } = setup(t);
  for (const visitAt of [
    '2026-12-01T08:59:59+09:00',
    '2026-12-01T21:00:01+09:00',
    'invalid',
    '2026-12-01T10:00:00',
  ])
    assert.throws(() => svc.apply(room.id, { visitAt }, student()));
});
test('잘못된 정원과 운영 기간을 거절한다', (t) => {
  const { svc } = setup(t);
  for (const maxPersonnel of [0, -1, 1.5, '2'])
    assert.throws(() => svc.saveRoom(null, { ...fields, maxPersonnel }, teacher));
  assert.throws(() => svc.saveRoom(null, { ...fields, endDate: fields.startDate }, teacher));
});
test('현재 인원보다 작은 정원으로 변경할 수 없다', (t) => {
  const { svc, room } = setup(t);
  svc.apply(room.id, at, student());
  svc.apply(room.id, at, student(2));
  assert.throws(() => svc.saveRoom(room.id, { ...fields, maxPersonnel: 1 }, teacher), /현재 신청/);
  assert.equal(svc.detail(room.id, teacher).maxPersonnel, 2);
});
test('기존 신청이 벗어나는 운영 기간 변경을 거절한다', (t) => {
  const { svc, room } = setup(t);
  svc.apply(room.id, at, student());
  assert.throws(
    () => svc.saveRoom(room.id, { ...fields, startDate: '2026-12-01T11:00:00+09:00' }, teacher),
    /기존 방문/,
  );
});
test('유효한 자습실 수정은 기존 신청을 유지한다', (t) => {
  const { svc, room } = setup(t);
  svc.apply(room.id, at, student());
  svc.saveRoom(room.id, { ...fields, name: '변경', maxPersonnel: 1 }, teacher);
  const d = svc.detail(room.id, teacher);
  assert.equal(d.name, '변경');
  assert.equal(d.count, 1);
});
test('Soft Delete는 모든 활성 신청을 취소하고 이력을 남긴다', (t) => {
  const { svc, room, store } = setup(t);
  svc.apply(room.id, at, student());
  svc.deleteRoom(room.id, teacher);
  assert.ok(!svc.rooms().some((r) => r.id === room.id));
  assert.throws(() => svc.apply(room.id, at, student(2)), /찾을 수/);
  assert.equal(svc.mine(student())[0].status, 'CANCELLED');
  assert.ok(store.read().rooms.find((r) => r.id === room.id)?.deletedAt);
  assert.equal(store.read().history.at(-1)?.reason, '자습실 삭제로 자동 취소');
});
test('학생에게 타인 신청과 이력을 노출하지 않는다', (t) => {
  const { svc, room } = setup(t);
  svc.apply(room.id, at, student());
  assert.deepEqual(svc.detail(room.id, student(2)).history, []);
  assert.deepEqual(svc.detail(room.id, student(2)).visits, []);
  assert.equal(svc.mine(student(2)).length, 0);
});
test('학생은 자습실과 학생 정보를 관리할 수 없다', (t) => {
  const { svc, room } = setup(t);
  assert.throws(() => svc.saveRoom(null, fields, student()), /강사/);
  assert.throws(() => svc.deleteRoom(room.id, student()), /강사/);
  assert.throws(
    () => svc.saveStudent(null, { name: '홍길동', phone: '010-1234-5678' }, student()),
    /강사/,
  );
});
test('학생 CRUD 및 활성 신청 학생 삭제 보호', (t) => {
  const { svc, room } = setup(t);
  const s = svc.saveStudent(null, { name: '홍길동', phone: '010-1234-5678' }, teacher);
  svc.saveStudent(s.id, { name: '홍길동2', phone: '010-9999-8888' }, teacher);
  const v = svc.apply(room.id, at, student(s.id));
  assert.throws(() => svc.deleteStudent(s.id, teacher), /활성 신청/);
  svc.changeVisit(v.id, {}, student(s.id), true);
  svc.deleteStudent(s.id, teacher);
  assert.ok(!svc.students().some((x) => x.id === s.id));
  assert.throws(() => svc.apply(room.id, at, student(s.id)), /학생을 찾을/);
});
test('디스크 재로드 후 신청과 이력이 유지된다', (t) => {
  const { svc, room, file } = setup(t);
  svc.apply(room.id, at, student());
  const reloaded = new Service(new Store(file));
  assert.equal(reloaded.detail(room.id, teacher).count, 1);
  assert.equal(reloaded.detail(room.id, teacher).history.length, 1);
});
test('실패한 트랜잭션은 메모리와 파일 모두 변경하지 않는다', (t) => {
  const { store, file } = setup(t);
  const before = store.read();
  assert.throws(() =>
    store.transaction((s) => {
      s.rooms.length = 0;
      throw Error('rollback');
    }),
  );
  assert.deepEqual(store.read(), before);
  assert.deepEqual(new Store(file).read(), before);
});
test('변경 없는 수정은 불필요한 이력을 추가하지 않는다', (t) => {
  const { svc, room } = setup(t);
  const v = svc.apply(room.id, at, student());
  svc.changeVisit(v.id, at, student());
  assert.equal(svc.detail(room.id, teacher).history.length, 1);
});

test('존재하지 않는 날짜와 24시 자동 보정을 허용하지 않는다', (t) => {
  const { svc } = setup(t);
  for (const startDate of ['2026-02-30T09:00:00+09:00', '2026-12-01T24:00:00+09:00']) {
    assert.throws(() => svc.saveRoom(null, { ...fields, startDate }, teacher), /올바른 일시/);
  }
});

test('운영 기간 밖 시간 수정과 중복 취소는 상태와 이력을 변경하지 않는다', (t) => {
  const { svc, room, store } = setup(t);
  const v = svc.apply(room.id, at, student());
  const before = store.read();
  assert.throws(
    () => svc.changeVisit(v.id, { visitAt: '2026-12-02T00:00:00Z' }, student()),
    /운영 기간/,
  );
  assert.deepEqual(store.read(), before);
  svc.changeVisit(v.id, {}, student(), true);
  const cancelled = store.read();
  assert.throws(() => svc.changeVisit(v.id, {}, student(), true), /이미 취소/);
  assert.deepEqual(store.read(), cancelled);
});
test('강사는 내 신청 전용 API를 사용할 수 없다', (t) => {
  const { svc } = setup(t);
  assert.throws(() => svc.mine(teacher), /학생만/);
});
test('이력은 발생 시각순이며 같은 시각에는 ID 순서로 표시한다', (t) => {
  const { svc, room, store } = setup(t);
  const v = svc.apply(room.id, at, student());
  svc.changeVisit(v.id, { visitAt: fields.endDate }, student());
  svc.changeVisit(v.id, {}, student(), true);
  store.transaction((s) => {
    s.history[0].createdAt = '2026-12-01T10:00:00Z';
    s.history[1].createdAt = '2026-12-01T09:00:00Z';
    s.history[2].createdAt = '2026-12-01T10:00:00Z';
    return true;
  });
  assert.deepEqual(
    svc.detail(room.id, teacher).history.map((h) => h.id),
    [2, 1, 3],
  );
});
test('삭제는 여러 활성 신청만 취소하며 이미 취소된 신청의 이력을 중복 생성하지 않는다', (t) => {
  const { svc, room, store } = setup(t);
  const v = svc.apply(room.id, at, student());
  svc.apply(room.id, at, student(2));
  svc.changeVisit(v.id, {}, student(), true);
  svc.apply(room.id, at, student(3));
  svc.deleteRoom(room.id, teacher);
  assert.equal(store.read().visits.filter((v) => v.status === 'ACTIVE').length, 0);
  assert.equal(
    store.read().history.filter((h) => h.reason === '자습실 삭제로 자동 취소').length,
    2,
  );
});

test('JSON 객체가 아닌 입력은 상태 변경 없이 400으로 거절한다', (t) => {
  const { svc, room, store } = setup(t);
  const before = store.read();
  for (const body of [null, undefined, [], 'invalid', 42, true]) {
    for (const action of [
      () => svc.saveRoom(null, body, teacher),
      () => svc.saveStudent(null, body, teacher),
      () => svc.apply(room.id, body, student()),
    ]) {
      assert.throws(
        action,
        (error: unknown) =>
          error instanceof Error &&
          'getStatus' in error &&
          typeof error.getStatus === 'function' &&
          error.getStatus() === 400,
      );
    }
  }
  assert.deepEqual(store.read(), before);
});
