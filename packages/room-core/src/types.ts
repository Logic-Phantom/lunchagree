// 방 공통 타입. 서버(Supabase)와 한 기기 모드가 같은 모양을 쓴다.
// 개인 조건(Preference)은 서버 밖으로 개별 값이 나가지 않는다 — 다른 참가자 화면에는 그룹 요약만 내려간다.

export type RoomStatus = 'COLLECTING' | 'VOTING' | 'DECIDED' | 'CLOSED';

export interface Room {
  id: string;
  shortCode: string;
  title: string;
  stationId: string | null;
  meetingText: string | null;
  date: string; // YYYY-MM-DD (KST)
  returnBy: string | null; // HH:mm
  mealMinutes: number;
  maxWalkMinutes: number;
  defaultBudget: number | null;
  status: RoomStatus;
  expiresAt: string; // ISO
  hostParticipantId: string;
  decidedCandidateId: string | null;
}

export interface Participant {
  id: string;
  roomId: string;
  nickname: string;
  isReady: boolean;
  hasVoted: boolean;
}

export interface Preference {
  participantId: string;
  maxBudget: number | null;
  likes: string[];
  cannotEat: string[];
  maxWalkMinutes: number | null;
}

export type CandidateSource = 'PUBLIC_DATA' | 'MANUAL';

export interface Candidate {
  id: string;
  roomId: string;
  source: CandidateSource;
  placeId: string | null;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  tags: string[];
  priceHint: number | null;
  priceType: 'USER_REPORTED' | 'UNKNOWN';
  addedBy: string;
}

export interface Vote {
  roomId: string;
  participantId: string;
  candidateId: string;
}
