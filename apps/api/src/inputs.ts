import { BadRequestException } from '@nestjs/common';
export const fail = (message: string): never => {
  throw new BadRequestException(message);
};
export function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    return fail(`${label}은(는) 1 이상의 정수여야 합니다.`);
  return value;
}
function date(value: unknown): string {
  if (typeof value !== 'string') return fail('시간대가 포함된 올바른 일시를 입력해 주세요.');
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!match) return fail('시간대가 포함된 올바른 일시를 입력해 주세요.');
  const [, year, month, day, hour, minute, second] = match;
  const calendar = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (
    !Number.isFinite(+calendar) ||
    calendar.toISOString().slice(0, 10) !== `${year}-${month}-${day}` ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59 ||
    !Number.isFinite(Date.parse(value))
  ) {
    return fail('시간대가 포함된 올바른 일시를 입력해 주세요.');
  }
  const normalized = new Date(value).toISOString();
  if (normalized.length !== 24) return fail('지원하지 않는 연도입니다.');
  return normalized;
}
function text(value: unknown, label: string, max = 80): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    return fail(`${label}은(는) 1~${max}자로 입력해 주세요.`);
  return value.trim();
}

export interface RoomInput {
  name: string;
  maxPersonnel: number;
  startDate: string;
  endDate: string;
}
export interface StudentInput {
  name: string;
  phone: string;
}
export interface VisitInput {
  visitAt: string;
}
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return fail('JSON 객체를 입력해 주세요.');
  return value as Record<string, unknown>;
}
export function roomInput(value: unknown): RoomInput {
  const body = object(value);
  const fields = {
    name: text(body.name, '자습실 이름'),
    maxPersonnel: integer(body.maxPersonnel, '최대 인원'),
    startDate: date(body.startDate),
    endDate: date(body.endDate),
  };
  if (fields.startDate >= fields.endDate) fail('종료 일시는 시작 일시보다 늦어야 합니다.');
  return fields;
}
export function studentInput(value: unknown): StudentInput {
  const body = object(value);
  const name = text(body.name, '이름', 40);
  const phone = text(body.phone, '연락처', 20);
  if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(phone)) fail('올바른 휴대전화 번호를 입력해 주세요.');
  return { name, phone };
}
export function visitInput(value: unknown): VisitInput {
  return { visitAt: date(object(value).visitAt) };
}
