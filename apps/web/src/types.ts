export type Role = 'teacher' | 'student';
export type Page = 'rooms' | 'students' | 'mine';
export interface Room {
  id: number;
  name: string;
  maxPersonnel: number;
  startDate: string;
  endDate: string;
  count: number;
  deletedAt: string | null;
}
export interface Student {
  id: number;
  name: string;
  phone: string;
}
export interface Visit {
  id: number;
  roomId: number;
  studentId: number;
  studentName?: string;
  visitAt: string;
  status: 'ACTIVE' | 'CANCELLED';
  room?: Room;
}
export interface VisitEvent {
  id: number;
  action: string;
  studentName: string;
  before: string | null;
  after: string | null;
  createdAt: string;
  reason: string;
  actor: string;
}
export type RoomDetail = Room & { history: VisitEvent[]; visits: Visit[] };
