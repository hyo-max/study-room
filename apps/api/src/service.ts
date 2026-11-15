import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { History, nextId, Room, State, Store, Visit } from './store';
import { fail, roomInput, studentInput, visitInput } from './inputs';
export { integer } from './inputs';
export type Actor = { role: 'teacher' } | { role: 'student'; studentId: number };
export class Service {
  constructor(private store: Store) {}
  teacher(actor: Actor) {
    if (actor.role !== 'teacher') throw new ForbiddenException('강사만 사용할 수 있습니다.');
  }
  private student(s: State, id?: number) {
    const v = s.students.find((x) => x.id === id && !x.deletedAt);
    if (!v) throw new NotFoundException('학생을 찾을 수 없습니다.');
    return v;
  }
  private room(s: State, id: number) {
    const v = s.rooms.find((x) => x.id === id && !x.deletedAt);
    if (!v) throw new NotFoundException('자습실을 찾을 수 없습니다.');
    return v;
  }
  private active(s: State, id: number) {
    return s.visits.filter((v) => v.roomId === id && v.status === 'ACTIVE');
  }
  private within(room: Room, at: string) {
    if (at < room.startDate || at > room.endDate) fail('방문 시간은 운영 기간 안이어야 합니다.');
  }
  private event(
    s: State,
    v: Visit,
    action: History['action'],
    before: string | null,
    actor: Actor,
    reason = '',
  ) {
    s.history.push({
      id: nextId(s.history),
      roomId: v.roomId,
      visitId: v.id,
      studentId: v.studentId,
      action,
      before,
      after: v.status === 'ACTIVE' ? v.visitAt : null,
      reason,
      actor: actor.role === 'teacher' ? '강사' : `학생 #${actor.studentId}`,
      createdAt: new Date().toISOString(),
    });
  }
  rooms() {
    const s = this.store.read();
    return s.rooms
      .filter((r) => !r.deletedAt)
      .map((r) => ({ ...r, count: this.active(s, r.id).length }));
  }
  students() {
    return this.store.read().students.filter((s) => !s.deletedAt);
  }
  detail(id: number, actor: Actor) {
    const s = this.store.read();
    const room = this.room(s, id);
    return {
      ...room,
      count: this.active(s, id).length,
      history:
        actor.role === 'teacher'
          ? s.history
              .filter((h) => h.roomId === id)
              .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id)
              .map((h) => ({
                ...h,
                studentName: s.students.find((x) => x.id === h.studentId)?.name,
              }))
          : [],
      visits:
        actor.role === 'teacher'
          ? this.active(s, id).map((v) => ({
              ...v,
              studentName: s.students.find((x) => x.id === v.studentId)?.name,
            }))
          : [],
    };
  }
  saveRoom(id: number | null, body: unknown, actor: Actor) {
    this.teacher(actor);
    const fields = roomInput(body);
    return this.store.transaction((s) => {
      const now = new Date().toISOString();
      if (id !== null) {
        const r = this.room(s, id);
        const visits = this.active(s, id);
        if (visits.length > fields.maxPersonnel)
          throw new ConflictException('현재 신청 인원보다 정원을 줄일 수 없습니다.');
        if (visits.some((v) => v.visitAt < fields.startDate || v.visitAt > fields.endDate))
          throw new ConflictException('기존 방문 신청이 변경할 운영 기간을 벗어납니다.');
        Object.assign(r, fields, { updatedAt: now });
        return r;
      }
      const r = { id: nextId(s.rooms), ...fields, createdAt: now, updatedAt: now, deletedAt: null };
      s.rooms.push(r);
      return r;
    });
  }
  deleteRoom(id: number, actor: Actor) {
    this.teacher(actor);
    return this.store.transaction((s) => {
      const r = this.room(s, id);
      r.deletedAt = r.updatedAt = new Date().toISOString();
      for (const v of this.active(s, id)) {
        v.status = 'CANCELLED';
        v.updatedAt = r.updatedAt;
        this.event(s, v, 'CANCELLED', v.visitAt, actor, '자습실 삭제로 자동 취소');
      }
      return { success: true };
    });
  }
  mine(actor: Actor) {
    if (actor.role !== 'student') throw new ForbiddenException('학생만 조회할 수 있습니다.');
    const s = this.store.read();
    this.student(s, actor.studentId);
    return s.visits
      .filter((v) => v.studentId === actor.studentId)
      .map((v) => ({ ...v, room: s.rooms.find((r) => r.id === v.roomId) }));
  }
  apply(id: number, body: unknown, actor: Actor) {
    if (actor.role !== 'student') throw new ForbiddenException('학생만 신청할 수 있습니다.');
    const at = visitInput(body).visitAt;
    return this.store.transaction((s) => {
      this.student(s, actor.studentId);
      const r = this.room(s, id);
      this.within(r, at);
      let v = s.visits.find((v) => v.roomId === id && v.studentId === actor.studentId);
      if (v?.status === 'ACTIVE') throw new ConflictException('이미 신청한 자습실입니다.');
      if (this.active(s, id).length >= r.maxPersonnel)
        throw new ConflictException('정원이 가득 찼습니다.');
      const now = new Date().toISOString();
      const previous = v?.visitAt ?? null;
      const reapply = !!v;
      if (v) Object.assign(v, { visitAt: at, status: 'ACTIVE', updatedAt: now });
      else {
        v = {
          id: nextId(s.visits),
          roomId: id,
          studentId: actor.studentId,
          visitAt: at,
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        };
        s.visits.push(v);
      }
      this.event(s, v, reapply ? 'REAPPLIED' : 'APPLIED', previous, actor);
      return v;
    });
  }
  changeVisit(id: number, body: unknown, actor: Actor, cancel = false) {
    if (actor.role !== 'student') throw new ForbiddenException('학생만 변경할 수 있습니다.');
    return this.store.transaction((s) => {
      this.student(s, actor.studentId);
      const v = s.visits.find((v) => v.id === id);
      if (!v) throw new NotFoundException('신청을 찾을 수 없습니다.');
      if (v.studentId !== actor.studentId)
        throw new ForbiddenException('본인 신청만 변경할 수 있습니다.');
      if (v.status !== 'ACTIVE') throw new ConflictException('이미 취소된 신청입니다.');
      const r = this.room(s, v.roomId);
      const before = v.visitAt;
      if (cancel) v.status = 'CANCELLED';
      else {
        const at = visitInput(body).visitAt;
        this.within(r, at);
        if (at === before) return v;
        v.visitAt = at;
      }
      v.updatedAt = new Date().toISOString();
      this.event(s, v, cancel ? 'CANCELLED' : 'CHANGED', before, actor);
      return v;
    });
  }
  saveStudent(id: number | null, body: unknown, actor: Actor) {
    this.teacher(actor);
    const { name, phone } = studentInput(body);
    return this.store.transaction((s) => {
      const now = new Date().toISOString();
      if (id !== null) {
        const v = this.student(s, id);
        Object.assign(v, { name, phone, updatedAt: now });
        return v;
      }
      const v = {
        id: nextId(s.students),
        name,
        phone,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      s.students.push(v);
      return v;
    });
  }
  deleteStudent(id: number, actor: Actor) {
    this.teacher(actor);
    return this.store.transaction((s) => {
      const v = this.student(s, id);
      if (s.visits.some((r) => r.studentId === id && r.status === 'ACTIVE'))
        throw new ConflictException('활성 신청을 먼저 취소해 주세요.');
      v.deletedAt = v.updatedAt = new Date().toISOString();
      return { success: true };
    });
  }
}
