import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmt, time, inputDate, iso } from '../src/date-time';
test('초와 밀리초가 있는 서버 일시는 편집 후에도 손실되지 않는다', () => {
  const original = '2026-12-01T00:00:30.125Z';
  assert.equal(iso(inputDate(original)), original);
});
test('분 단위 브라우저 입력을 KST 기준으로 해석한다', () => {
  assert.equal(iso('2026-12-01T09:30'), '2026-12-01T00:30:00.000Z');
});
test('초 단위 브라우저 입력을 KST 기준으로 해석한다', () => {
  assert.equal(iso('2026-12-01T09:30:45'), '2026-12-01T00:30:45.000Z');
});

test('화면의 이력에도 0이 아닌 초와 밀리초를 표시한다', () => {
  const at = '2026-12-01T00:00:30.125Z';
  assert.match(time(at), /09:00:30[.,]125/);
  assert.match(fmt(at), /09:00:30[.,]125/);
  assert.ok(fmt(at, true).includes('26'));
});
