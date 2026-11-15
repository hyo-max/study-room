import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
test('HTTP E2E: 역할 검증, 동시 정원 경쟁, 취소·재신청·삭제', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'study-http-'));
  const port = 31000 + Math.floor(Math.random() * 10000);
  const child = spawn(process.execPath, [resolve('dist/main.js')], {
    env: { ...process.env, PORT: String(port), DATA_FILE: join(dir, 'db.json') },
    stdio: 'pipe',
  });
  let logs = '';
  child.stderr.on('data', (d) => (logs += d));
  child.stdout.on('data', (d) => (logs += d));
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await once(child, 'exit');
    }
    rmSync(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}/api`;
  let ready = false;
  for (let n = 0; n < 80; n++) {
    try {
      if ((await fetch(`${base}/health`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, logs);
  const req = async (path: string, method = 'GET', body?: unknown, role = 'teacher', student = 1) =>
    fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-role': role,
        'x-student-id': String(student),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  assert.equal((await fetch(`${base}/rooms`)).status, 401);
  const fields = {
    name: 'HTTP 테스트',
    maxPersonnel: 1,
    startDate: '2026-12-01T00:00:00Z',
    endDate: '2026-12-01T12:00:00Z',
  };
  assert.equal((await req('/rooms', 'POST', fields, 'student')).status, 403);
  assert.equal((await req('/rooms', 'POST', { ...fields, maxPersonnel: 0 })).status, 400);
  const response = await req('/rooms', 'POST', fields);
  assert.equal(response.status, 201);
  const room = await response.json();
  const requests = await Promise.all(
    [1, 2, 3, 4, 5, 6].map((s) =>
      req(`/rooms/${room.id}/visits`, 'POST', { visitAt: fields.startDate }, 'student', s),
    ),
  );
  assert.equal(requests.filter((r) => r.status === 201).length, 1);
  assert.equal(requests.filter((r) => r.status === 409).length, 5);
  const winnerIndex = requests.findIndex((r) => r.status === 201);
  const visit = await requests[winnerIndex].json();
  const winner = winnerIndex + 1;
  assert.equal(
    (await req(`/visits/${visit.id}`, 'PATCH', { visitAt: fields.endDate }, 'student', winner))
      .status,
    200,
  );
  assert.equal(
    (await req(`/visits/${visit.id}`, 'DELETE', undefined, 'student', winner === 1 ? 2 : 1)).status,
    403,
  );
  assert.equal(
    (await req(`/visits/${visit.id}`, 'DELETE', undefined, 'student', winner)).status,
    200,
  );
  assert.equal(
    (
      await req(
        `/rooms/${room.id}/visits`,
        'POST',
        { visitAt: fields.startDate },
        'student',
        winner,
      )
    ).status,
    201,
  );
  const detail = await (await req(`/rooms/${room.id}`)).json();
  assert.equal(detail.count, 1);
  assert.equal(detail.history.length, 4);
  assert.equal((await req(`/rooms/${room.id}`, 'DELETE')).status, 200);
  assert.equal(
    (
      await req(
        `/rooms/${room.id}/visits`,
        'POST',
        { visitAt: fields.startDate },
        'student',
        winner,
      )
    ).status,
    404,
  );
  const mine = await (await req('/visits/mine', 'GET', undefined, 'student', winner)).json();
  assert.equal(mine[0].status, 'CANCELLED');
  assert.ok(mine[0].room.deletedAt);
  await t.test('자습실 CRUD: 수정 필드 반영, 목록 집계, 삭제 제외', async () => {
    const created = await (await req('/rooms', 'POST', fields)).json();
    const edit = {
      ...fields,
      name: '수정된 자습실',
      maxPersonnel: 3,
      endDate: '2026-12-01T13:00:00Z',
    };
    assert.equal((await req(`/rooms/${created.id}`, 'PATCH', edit)).status, 200);
    const list = await (await req('/rooms')).json();
    const found = list.find((r: { id: number }) => r.id === created.id);
    assert.equal(found.name, edit.name);
    assert.equal(found.maxPersonnel, 3);
    assert.equal(found.count, 0);
    assert.equal(found.endDate, '2026-12-01T13:00:00.000Z');
    await req(`/rooms/${created.id}`, 'DELETE');
    assert.equal((await req(`/rooms/${created.id}`)).status, 404);
    assert.ok(
      !(await (await req('/rooms')).json()).some((r: { id: number }) => r.id === created.id),
    );
  });
  await t.test('학생 CRUD: 필수 필드, 유효성, Soft Delete, 삭제된 학생 신청 금지', async () => {
    assert.equal((await req('/students', 'POST', { name: '', phone: 'wrong' })).status, 400);
    const created = await (
      await req('/students', 'POST', { name: '신규 학생', phone: '010-1234-5678' })
    ).json();
    for (const key of ['id', 'name', 'phone', 'createdAt', 'updatedAt', 'deletedAt'])
      assert.ok(key in created);
    assert.equal(created.deletedAt, null);
    const edited = await (
      await req(`/students/${created.id}`, 'PATCH', { name: '수정 학생', phone: '010-9999-8888' })
    ).json();
    assert.equal(edited.name, '수정 학생');
    assert.equal(edited.phone, '010-9999-8888');
    assert.equal((await req(`/students/${created.id}`, 'DELETE')).status, 200);
    assert.ok(
      !(await (await req('/students')).json()).some((s: { id: number }) => s.id === created.id),
    );
    const r = await (await req('/rooms', 'POST', fields)).json();
    assert.equal(
      (
        await req(
          `/rooms/${r.id}/visits`,
          'POST',
          { visitAt: fields.startDate },
          'student',
          created.id,
        )
      ).status,
      404,
    );
  });
  await t.test('동일 학생의 동시 중복 신청은 한 건만 생성한다', async () => {
    const r = await (await req('/rooms', 'POST', { ...fields, maxPersonnel: 6 })).json();
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        req(`/rooms/${r.id}/visits`, 'POST', { visitAt: fields.startDate }, 'student'),
      ),
    );
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(results.filter((r) => r.status === 409).length, 5);
    const d = await (await req(`/rooms/${r.id}`)).json();
    assert.equal(d.count, 1);
    assert.equal(d.history.length, 1);
  });
  await t.test('시작/종료 오류와 운영 기간 밖 신청·수정을 서버에서 거절한다', async () => {
    assert.equal(
      (await req('/rooms', 'POST', { ...fields, endDate: fields.startDate })).status,
      400,
    );
    assert.equal(
      (await req('/rooms', 'POST', { ...fields, startDate: '2026-02-30T09:00:00Z' })).status,
      400,
    );
    const r = await (await req('/rooms', 'POST', fields)).json();
    assert.equal(
      (await req(`/rooms/${r.id}/visits`, 'POST', { visitAt: '2026-12-02T00:00:00Z' }, 'student'))
        .status,
      400,
    );
    const v = await (
      await req(`/rooms/${r.id}/visits`, 'POST', { visitAt: fields.startDate }, 'student')
    ).json();
    assert.equal(
      (await req(`/visits/${v.id}`, 'PATCH', { visitAt: '2026-12-02T00:00:00Z' }, 'student'))
        .status,
      400,
    );
    assert.equal((await (await req(`/rooms/${r.id}`)).json()).history.length, 1);
  });
  await t.test('정원 축소와 기간 변경 충돌은 기존 신청을 유지한다', async () => {
    const r = await (await req('/rooms', 'POST', { ...fields, maxPersonnel: 2 })).json();
    for (const student of [1, 2])
      await req(`/rooms/${r.id}/visits`, 'POST', { visitAt: fields.startDate }, 'student', student);
    assert.equal((await req(`/rooms/${r.id}`, 'PATCH', fields)).status, 409);
    assert.equal(
      (
        await req(`/rooms/${r.id}`, 'PATCH', {
          ...fields,
          maxPersonnel: 2,
          startDate: '2026-12-01T01:00:00Z',
        })
      ).status,
      409,
    );
    const d = await (await req(`/rooms/${r.id}`)).json();
    assert.equal(d.count, 2);
    assert.equal(d.maxPersonnel, 2);
    assert.equal(d.history.length, 2);
  });
  await t.test('학생에게 타인 신청/이력을 노출하지 않고 강사 관리 요청을 거절한다', async () => {
    const r = await (await req('/rooms', 'POST', fields)).json();
    const v = await (
      await req(`/rooms/${r.id}/visits`, 'POST', { visitAt: fields.startDate }, 'student')
    ).json();
    const d = await (await req(`/rooms/${r.id}`, 'GET', undefined, 'student', 2)).json();
    assert.deepEqual(d.history, []);
    assert.deepEqual(d.visits, []);
    assert.equal(
      (await req(`/visits/${v.id}`, 'PATCH', { visitAt: fields.endDate }, 'student', 2)).status,
      403,
    );
    assert.equal((await req(`/rooms/${r.id}`, 'PATCH', fields, 'student')).status, 403);
    assert.equal((await req(`/rooms/${r.id}`, 'DELETE', undefined, 'student')).status, 403);
    assert.equal(
      (await req('/students', 'POST', { name: '학생', phone: '010-1234-5678' }, 'student')).status,
      403,
    );
    assert.equal((await req('/visits/mine')).status, 403);
  });
  await t.test('취소 후 정원 복원, 중복 취소 거절, 다른 학생 신청 가능', async () => {
    const r = await (await req('/rooms', 'POST', fields)).json();
    const v = await (
      await req(`/rooms/${r.id}/visits`, 'POST', { visitAt: fields.startDate }, 'student')
    ).json();
    await req(`/visits/${v.id}`, 'DELETE', undefined, 'student');
    assert.equal((await req(`/visits/${v.id}`, 'DELETE', undefined, 'student')).status, 409);
    assert.equal((await (await req(`/rooms/${r.id}`)).json()).count, 0);
    assert.equal(
      (await req(`/rooms/${r.id}/visits`, 'POST', { visitAt: fields.endDate }, 'student', 2))
        .status,
      201,
    );
  });
  await t.test('없는 리소스와 잘못된 ID는 404/400을 반환한다', async () => {
    assert.equal((await req('/rooms/999999')).status, 404);
    assert.equal((await req('/rooms/not-an-id')).status, 400);
    assert.equal((await req('/rooms/-1')).status, 400);
    assert.equal((await req('/visits/999999', 'DELETE', undefined, 'student')).status, 404);
  });
});
