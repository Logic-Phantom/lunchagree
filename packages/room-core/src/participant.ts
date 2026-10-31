// 참여 규칙: 닉네임 검증, 인원 상한, 상태 전이.
import type { RoomStatus } from './types.ts';

export const MIN_PARTICIPANTS = 2;
export const MAX_PARTICIPANTS = 6;
export const NICKNAME_MAX = 10;

/** 앞뒤 공백 제거, 1~10자, 제어문자·꺾쇠 금지. 실패 시 null. */
export function normalizeNickname(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const name = input.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (name.length < 1 || [...name].length > NICKNAME_MAX) return null;
  if (/[\u0000-\u001f\u007f<>]/.test(name)) return null;
  return name;
}

export function canJoin(currentCount: number): boolean {
  return currentCount < MAX_PARTICIPANTS;
}

const NEXT: Record<RoomStatus, RoomStatus[]> = {
  COLLECTING: ['VOTING', 'CLOSED'],
  VOTING: ['DECIDED', 'COLLECTING', 'CLOSED'], // 후보 부족·조건 수정 시 다시 모으기
  DECIDED: ['VOTING', 'CLOSED'], // 재투표
  CLOSED: [],
};

export function canTransition(from: RoomStatus, to: RoomStatus): boolean {
  return NEXT[from].includes(to);
}
