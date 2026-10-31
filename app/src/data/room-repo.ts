// 방 저장소. 두 가지 구현이 같은 RoomView를 만든다.
//  - local : 한 기기 모드. 방장 폰 하나로 참가자를 추가하고 돌려 가며 조건·투표를 입력한다. 서버 전송 없음(기기 로컬 Storage).
//  - remote: 공유 방(Supabase Free). 테이블 직접 접근 없이 RPC만 호출한다(packages/room-core/supabase/migrations).
// Supabase 환경변수가 없으면 local만 쓴다. remote 구현은 실제 프로젝트에서 실행 확인 전(README 상태표).
import {
  anonHashForRoom, computeExpiresAt, generateShortCode, generateToken, kstDate, MAX_PARTICIPANTS, normalizeNickname,
  type Candidate, type Participant, type Preference, type Room, type RoomStatus, type Vote,
} from '@jeomsimhabui/room-core';
import { aggregatePreferences, type GroupConstraints } from '../domain';
import { anonymousKey } from '../platform/toss';
import { store } from '../storage/kv';

export type RoomMode = 'local' | 'remote';

export interface RoomView {
  mode: RoomMode;
  room: Room;
  participants: Participant[];
  /** 이 기기의 참가자(local은 방장). */
  meId: string;
  /** remote: 내 조건만. local: 모든 참가자 조건(기기 안에서만 보관, 화면에는 그룹 요약만 표시). */
  preferences: Record<string, Preference>;
  group: GroupConstraints;
  candidates: Candidate[];
  voteCounts: Record<string, number>;
  /** 참가자별 투표(local만 — remote는 남의 표를 받지 않는다). */
  votesBy: Record<string, string>;
  myVote: string | null;
}

export interface CreateRoomInput {
  title: string;
  stationId: string | null;
  meetingText: string | null;
  returnBy: string | null;
  maxWalkMinutes: number;
  defaultBudget: number | null;
  hostNickname: string;
  hostPreference: Omit<Preference, 'participantId'>;
  /** local 모드에서 미리 추가할 참가자 닉네임. */
  others: string[];
}

export type NewCandidate = Pick<Candidate, 'source' | 'placeId' | 'name' | 'address' | 'lat' | 'lng' | 'tags' | 'priceHint'>;

export interface RoomRepo {
  mode: RoomMode;
  create(input: CreateRoomInput): Promise<string>;
  load(roomId: string): Promise<RoomView | null>;
  addParticipant(roomId: string, nickname: string): Promise<string>;
  savePreference(roomId: string, participantId: string, pref: Omit<Preference, 'participantId'>): Promise<void>;
  addCandidate(roomId: string, participantId: string, c: NewCandidate): Promise<string>;
  castVote(roomId: string, participantId: string, candidateId: string): Promise<void>;
  setStatus(roomId: string, status: RoomStatus, decidedCandidateId?: string | null): Promise<void>;
  /** 초대 링크용 토큰(remote만). */
  inviteToken(roomId: string): Promise<string | null>;
}

export class RoomError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

// ---------------------------------------------------------------------------
// local (한 기기 모드)
// ---------------------------------------------------------------------------
interface LocalRoomData {
  v: 1;
  room: Room;
  participants: Participant[];
  preferences: Record<string, Preference>;
  candidates: Candidate[];
  votes: Vote[];
}

const roomKey = (id: string) => `room.v1:${id}`;

async function readLocal(roomId: string): Promise<LocalRoomData | null> {
  const raw = await store.get(roomKey(roomId));
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as LocalRoomData;
    return d?.v === 1 && d.room?.id === roomId ? d : null;
  } catch {
    return null;
  }
}

async function writeLocal(d: LocalRoomData): Promise<void> {
  await store.set(roomKey(d.room.id), JSON.stringify(d));
}

function toView(d: LocalRoomData): RoomView {
  const voteCounts: Record<string, number> = {};
  const votesBy: Record<string, string> = {};
  for (const v of d.votes) votesBy[v.participantId] = v.candidateId;
  for (const cid of Object.values(votesBy)) voteCounts[cid] = (voteCounts[cid] ?? 0) + 1;
  const participants = d.participants.map((p) => ({ ...p, isReady: !!d.preferences[p.id], hasVoted: !!votesBy[p.id] }));
  return {
    mode: 'local',
    room: d.room,
    participants,
    meId: d.room.hostParticipantId,
    preferences: d.preferences,
    group: aggregatePreferences(Object.values(d.preferences), participants.length),
    candidates: d.candidates,
    voteCounts,
    votesBy,
    myVote: votesBy[d.room.hostParticipantId] ?? null,
  };
}

async function mutate(roomId: string, fn: (d: LocalRoomData) => void): Promise<void> {
  const d = await readLocal(roomId);
  if (!d) throw new RoomError('ROOM_NOT_FOUND');
  fn(d);
  await writeLocal(d);
}

export const localRepo: RoomRepo = {
  mode: 'local',
  async create(input) {
    const now = new Date();
    const roomId = crypto.randomUUID();
    const hostId = crypto.randomUUID();
    const mk = (id: string, nickname: string): Participant => ({ id, roomId, nickname, isReady: false, hasVoted: false });
    const others = input.others.map((n) => normalizeNickname(n)).filter((n): n is string => !!n).slice(0, MAX_PARTICIPANTS - 1);
    const d: LocalRoomData = {
      v: 1,
      room: {
        id: roomId,
        shortCode: generateShortCode(),
        title: input.title,
        stationId: input.stationId,
        meetingText: input.meetingText,
        date: kstDate(now),
        returnBy: input.returnBy,
        mealMinutes: 50,
        maxWalkMinutes: input.maxWalkMinutes,
        defaultBudget: input.defaultBudget,
        status: 'COLLECTING',
        expiresAt: computeExpiresAt(now).toISOString(),
        hostParticipantId: hostId,
        decidedCandidateId: null,
      },
      participants: [mk(hostId, normalizeNickname(input.hostNickname) ?? '나'), ...others.map((n) => mk(crypto.randomUUID(), n))],
      preferences: { [hostId]: { participantId: hostId, ...input.hostPreference } },
      candidates: [],
      votes: [],
    };
    await writeLocal(d);
    return roomId;
  },
  async load(roomId) {
    const d = await readLocal(roomId);
    return d ? toView(d) : null;
  },
  async addParticipant(roomId, nickname) {
    const name = normalizeNickname(nickname);
    if (!name) throw new RoomError('BAD_NICKNAME');
    const id = crypto.randomUUID();
    await mutate(roomId, (d) => {
      if (d.participants.length >= MAX_PARTICIPANTS) throw new RoomError('ROOM_FULL');
      d.participants.push({ id, roomId, nickname: name, isReady: false, hasVoted: false });
    });
    return id;
  },
  async savePreference(roomId, participantId, pref) {
    await mutate(roomId, (d) => {
      d.preferences[participantId] = { participantId, ...pref };
    });
  },
  async addCandidate(roomId, participantId, c) {
    const id = crypto.randomUUID();
    await mutate(roomId, (d) => {
      d.candidates.push({ ...c, id, roomId, addedBy: participantId, priceType: c.priceHint == null ? 'UNKNOWN' : 'USER_REPORTED' });
    });
    return id;
  },
  async castVote(roomId, participantId, candidateId) {
    await mutate(roomId, (d) => {
      if (d.room.status !== 'VOTING') throw new RoomError('NOT_VOTING');
      d.votes = d.votes.filter((v) => v.participantId !== participantId);
      d.votes.push({ roomId, participantId, candidateId });
    });
  },
  async setStatus(roomId, status, decidedCandidateId = null) {
    await mutate(roomId, (d) => {
      if (status === 'VOTING') d.votes = [];
      d.room.status = status;
      d.room.decidedCandidateId = status === 'DECIDED' ? decidedCandidateId : null;
    });
  },
  async inviteToken() {
    return null;
  },
};

// ---------------------------------------------------------------------------
// remote (Supabase RPC, supabase-js 없이 PostgREST /rest/v1/rpc 직접 호출)
// ---------------------------------------------------------------------------
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const SUPABASE_ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

export function remoteConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON.length > 0;
}

interface Credential {
  roomId: string;
  participantId: string;
  secret: string;
  /** 방장만 보관(초대 링크 재생성용). 참가자는 토큰을 저장하지 않는다. */
  token: string | null;
}
const credKey = (roomId: string) => `cred.v1:${roomId}`;

async function readCred(roomId: string): Promise<Credential | null> {
  const raw = await store.get(credKey(roomId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Credential;
  } catch {
    return null;
  }
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    let code = 'NETWORK';
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message && /^[A-Z_]+$/.test(body.message)) code = body.message;
    } catch {
      // 본문 없음
    }
    throw new RoomError(code);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

async function auth(roomId: string) {
  const c = await readCred(roomId);
  if (!c) throw new RoomError('NOT_PARTICIPANT');
  return { c, args: { p_room: roomId, p_pid: c.participantId, p_secret: c.secret } };
}

interface RemoteState {
  room: Room;
  me: { participantId: string; preference: (Preference & { participant_id?: string; max_budget?: number | null; cannot_eat?: string[]; max_walk_minutes?: number | null }) | null };
  participants: Participant[];
  group: Omit<GroupConstraints, 'participantCount'>;
  candidates: Candidate[];
  votes: Record<string, number>;
  myVote: string | null;
}

export const remoteRepo: RoomRepo = {
  mode: 'remote',
  async create(input) {
    const token = generateToken();
    const secret = generateToken();
    const anon = await anonHashForRoom(await anonymousKey(), token);
    const r = await rpc<{ roomId: string; participantId: string }>('create_room', {
      p_token: token, p_short_code: generateShortCode(), p_title: input.title, p_station_id: input.stationId,
      p_meeting_text: input.meetingText, p_return_by: input.returnBy, p_max_walk_minutes: input.maxWalkMinutes,
      p_default_budget: input.defaultBudget, p_anon_hash: anon, p_secret: secret, p_nickname: input.hostNickname,
    });
    const cred: Credential = { roomId: r.roomId, participantId: r.participantId, secret, token };
    await store.set(credKey(r.roomId), JSON.stringify(cred));
    await this.savePreference(r.roomId, r.participantId, input.hostPreference);
    return r.roomId;
  },
  async load(roomId) {
    const { args } = await auth(roomId);
    const s = await rpc<RemoteState>('get_room_state', args);
    const mineRaw = s.me.preference;
    const mine: Preference | null = mineRaw
      ? {
          participantId: s.me.participantId,
          maxBudget: mineRaw.max_budget ?? null,
          likes: mineRaw.likes ?? [],
          cannotEat: mineRaw.cannot_eat ?? [],
          maxWalkMinutes: mineRaw.max_walk_minutes ?? null,
        }
      : null;
    return {
      mode: 'remote',
      room: s.room,
      participants: s.participants.map((p) => ({ ...p, roomId })),
      meId: s.me.participantId,
      preferences: mine ? { [mine.participantId]: mine } : {},
      group: { ...s.group, participantCount: s.participants.length },
      candidates: s.candidates.map((c) => ({ ...c, roomId })),
      voteCounts: s.votes,
      votesBy: {},
      myVote: s.myVote,
    };
  },
  async addParticipant() {
    // 공유 방은 각자 링크로 참여한다
    throw new RoomError('REMOTE_JOIN_ONLY');
  },
  async savePreference(roomId, _participantId, pref) {
    const { args } = await auth(roomId);
    await rpc('save_preference', {
      ...args, p_max_budget: pref.maxBudget, p_likes: pref.likes, p_cannot_eat: pref.cannotEat, p_max_walk_minutes: pref.maxWalkMinutes,
    });
  },
  async addCandidate(roomId, _participantId, c) {
    const { args } = await auth(roomId);
    return rpc<string>('add_candidate', {
      ...args, p_source: c.source, p_place_id: c.placeId, p_name: c.name, p_address: c.address, p_lat: c.lat, p_lng: c.lng,
      p_tags: c.tags, p_price_hint: c.priceHint,
    });
  },
  async castVote(roomId, _participantId, candidateId) {
    const { args } = await auth(roomId);
    await rpc('cast_vote', { ...args, p_candidate: candidateId });
  },
  async setStatus(roomId, status, decidedCandidateId = null) {
    const { args } = await auth(roomId);
    await rpc('set_room_status', { ...args, p_status: status, p_decided: decidedCandidateId });
  },
  async inviteToken(roomId) {
    return (await readCred(roomId))?.token ?? null;
  },
};

/** 링크(토큰) 또는 6자리 코드로 공유 방 참여. 성공 시 roomId. */
export async function joinRemote(by: { token: string } | { code: string }, nickname: string): Promise<string> {
  const name = normalizeNickname(nickname);
  if (!name) throw new RoomError('BAD_NICKNAME');
  const secret = generateToken();
  const key = await anonymousKey();
  const r =
    'token' in by
      ? await rpc<{ roomId: string; participantId: string }>('join_room', {
          p_token: by.token, p_anon_hash: await anonHashForRoom(key, by.token), p_secret: secret, p_nickname: name,
        })
      : await rpc<{ roomId: string; participantId: string }>('join_room_by_code', {
          p_code: by.code, p_anon_hash: await anonHashForRoom(key, 'code'), p_secret: secret, p_nickname: name,
        });
  const cred: Credential = { roomId: r.roomId, participantId: r.participantId, secret, token: null };
  await store.set(credKey(r.roomId), JSON.stringify(cred));
  return r.roomId;
}

export function repoFor(mode: RoomMode): RoomRepo {
  return mode === 'remote' ? remoteRepo : localRepo;
}

export function defaultMode(): RoomMode {
  return remoteConfigured() ? 'remote' : 'local';
}

export function errorMessage(e: unknown): string {
  const code = e instanceof RoomError ? e.code : 'UNKNOWN';
  const map: Record<string, string> = {
    ROOM_NOT_FOUND: '방을 찾을 수 없어요. 마감됐거나 링크가 잘못됐어요.',
    ROOM_FULL: '이 방은 6명이 모두 찼어요.',
    ROOM_CLOSED: '이미 끝난 방이에요.',
    ROOMS_DISABLED: '지금은 새 방을 만들 수 없어요. 한 기기 모드로 이용해 주세요.',
    TOO_MANY_ATTEMPTS: '코드 입력 횟수를 넘었어요. 잠시 후 다시 시도해 주세요.',
    NOT_VOTING: '지금은 투표 중이 아니에요.',
    HOST_ONLY: '방장만 할 수 있어요.',
    BAD_NICKNAME: '닉네임은 1~10자로 입력해 주세요.',
    NETWORK: '연결이 불안정해요. 잠시 후 다시 시도해 주세요.',
  };
  return map[code] ?? '문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
}
