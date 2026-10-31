// 기기 로컬 기록: 최근 방, 결정 기록(방문 기록), 내 기본 조건. 서버에 저장하지 않는다.
// 저장값은 읽을 때 다시 검증한다(다른 버전·손상 대비).
import { store, type KeyValueStore } from './kv';

export interface RecentRoom {
  roomId: string;
  title: string;
  mode: 'local' | 'remote';
  participantCount: number;
  updatedAt: string; // ISO
  expiresAt: string;
}

export interface DecisionRecord {
  roomId: string;
  roomTitle: string;
  placeName: string;
  tags: string[];
  decidedAt: string; // ISO
}

export interface DefaultPreference {
  maxBudget: number | null;
  likes: string[];
  cannotEat: string[];
  maxWalkMinutes: number | null;
}

const K_RECENT = 'recent-rooms.v1';
const K_HISTORY = 'decisions.v1';
const K_DEFAULT_PREF = 'default-preference.v1';
const MAX_RECENT = 10;
const MAX_HISTORY = 50;

async function readArray<T>(kv: KeyValueStore, key: string, valid: (x: unknown) => x is T): Promise<T[]> {
  const raw = await kv.get(key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(valid) : [];
  } catch {
    return [];
  }
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const isRecent = (x: unknown): x is RecentRoom => isObj(x) && typeof x.roomId === 'string' && typeof x.title === 'string';
const isDecision = (x: unknown): x is DecisionRecord => isObj(x) && typeof x.placeName === 'string' && typeof x.decidedAt === 'string';

export async function listRecentRooms(kv: KeyValueStore = store): Promise<RecentRoom[]> {
  return readArray(kv, K_RECENT, isRecent);
}

export async function touchRecentRoom(entry: RecentRoom, kv: KeyValueStore = store): Promise<void> {
  const list = (await listRecentRooms(kv)).filter((r) => r.roomId !== entry.roomId);
  await kv.set(K_RECENT, JSON.stringify([entry, ...list].slice(0, MAX_RECENT)));
}

export async function removeRecentRoom(roomId: string, kv: KeyValueStore = store): Promise<void> {
  const list = (await listRecentRooms(kv)).filter((r) => r.roomId !== roomId);
  await kv.set(K_RECENT, JSON.stringify(list));
}

export async function listDecisions(kv: KeyValueStore = store): Promise<DecisionRecord[]> {
  return readArray(kv, K_HISTORY, isDecision);
}

export async function addDecision(rec: DecisionRecord, kv: KeyValueStore = store): Promise<void> {
  const list = (await listDecisions(kv)).filter((r) => r.roomId !== rec.roomId);
  await kv.set(K_HISTORY, JSON.stringify([rec, ...list].slice(0, MAX_HISTORY)));
}

export async function clearDecisions(kv: KeyValueStore = store): Promise<void> {
  await kv.remove(K_HISTORY);
}

export async function loadDefaultPreference(kv: KeyValueStore = store): Promise<DefaultPreference | null> {
  const raw = await kv.get(K_DEFAULT_PREF);
  if (!raw) return null;
  try {
    const p: unknown = JSON.parse(raw);
    if (!isObj(p) || !Array.isArray(p.likes) || !Array.isArray(p.cannotEat)) return null;
    return {
      maxBudget: typeof p.maxBudget === 'number' ? p.maxBudget : null,
      likes: p.likes.filter((x): x is string => typeof x === 'string'),
      cannotEat: p.cannotEat.filter((x): x is string => typeof x === 'string'),
      maxWalkMinutes: typeof p.maxWalkMinutes === 'number' ? p.maxWalkMinutes : null,
    };
  } catch {
    return null;
  }
}

export async function saveDefaultPreference(p: DefaultPreference, kv: KeyValueStore = store): Promise<void> {
  await kv.set(K_DEFAULT_PREF, JSON.stringify(p));
}

/** "1시간 전", "어제" 같은 상대 시간. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return d === 1 ? '어제' : `${d}일 전`;
}
