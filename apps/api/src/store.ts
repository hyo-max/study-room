import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
export interface Base {
  id: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
export interface Student extends Base {
  name: string;
  phone: string;
}
export interface Room extends Base {
  name: string;
  maxPersonnel: number;
  startDate: string;
  endDate: string;
}
export interface Visit {
  id: number;
  roomId: number;
  studentId: number;
  visitAt: string;
  status: 'ACTIVE' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}
export interface History {
  id: number;
  roomId: number;
  visitId: number;
  studentId: number;
  action: 'APPLIED' | 'CHANGED' | 'CANCELLED' | 'REAPPLIED';
  before: string | null;
  after: string | null;
  reason: string;
  actor: string;
  createdAt: string;
}
export interface State {
  students: Student[];
  rooms: Room[];
  visits: Visit[];
  history: History[];
}
export class Store {
  private state: State;
  constructor(private file = resolve(process.env.DATA_FILE || 'data/store.json')) {
    if (existsSync(file)) this.state = JSON.parse(readFileSync(file, 'utf8'));
    else {
      this.state = seed();
      this.persist(this.state);
    }
  }
  read(): State {
    return structuredClone(this.state);
  }
  // No await in this critical section: one Node process serializes validation + write.
  transaction<T>(fn: (state: State) => T): T {
    const draft = this.read();
    const result = fn(draft);
    this.persist(draft);
    this.state = draft;
    return structuredClone(result);
  }
  private persist(state: State) {
    mkdirSync(dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    writeFileSync(temp, JSON.stringify(state, null, 2));
    renameSync(temp, this.file);
  }
}
export function nextId(rows: { id: number }[]) {
  return Math.max(0, ...rows.map((r) => r.id)) + 1;
}
export function seed(current = new Date()): State {
  const now = current.toISOString();
  const base = { createdAt: now, updatedAt: now, deletedAt: null };
  const kst = new Date(current.getTime() + 9 * 3600000);
  const start = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 1));
  const end = new Date(start.getTime() + 12 * 3600000);
  return {
    students: ['김민준', '이서연', '박지우', '최도윤', '정하은', '윤서준'].map((name, i) => ({
      ...base,
      id: i + 1,
      name,
      phone: `010-0000-${String(i + 1).padStart(4, '0')}`,
    })),
    rooms: ['몰입의 공간', '차분한 오후', '함께하는 자습'].map((name, i) => ({
      ...base,
      id: i + 1,
      name,
      maxPersonnel: [12, 8, 16][i],
      startDate: new Date(+start + i * 86400000).toISOString(),
      endDate: new Date(+end + i * 86400000).toISOString(),
    })),
    visits: [],
    history: [],
  };
}
