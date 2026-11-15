import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seed, Store } from '../src/store';
test('새벽 KST에도 초기 자습실이 다음날 09:00에 열린다', () => {
  for (const now of ['2026-11-15T17:00:00Z', '2026-11-16T11:00:00Z']) {
    assert.equal(seed(new Date(now)).rooms[0].startDate, '2026-11-17T00:00:00.000Z');
  }
});
test('파일 쓰기 실패 시 메모리와 기존 파일을 모두 유지한다', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'study-storage-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'store.json');
  const store = new Store(file);
  const before = store.read();
  mkdirSync(file + '.tmp');
  assert.throws(() =>
    store.transaction((s) => {
      s.students.length = 0;
      return true;
    }),
  );
  assert.deepEqual(store.read(), before);
  assert.deepEqual(new Store(file).read(), before);
});
