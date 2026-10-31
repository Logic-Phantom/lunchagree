// 방 만료: 당일 23:59(KST) 또는 생성 후 12시간 중 이른 시각. 서버 SQL(room_expires_at)과 같은 규칙.

export const ROOM_TTL_HOURS = 12;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 날짜 문자열(YYYY-MM-DD). */
export function kstDate(at: Date): string {
  return new Date(at.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function computeExpiresAt(createdAt: Date): Date {
  const ttl = new Date(createdAt.getTime() + ROOM_TTL_HOURS * 3600_000);
  // KST 23:59:00 = 같은 KST 날짜의 UTC 14:59:00
  const endOfDayKst = new Date(`${kstDate(createdAt)}T14:59:00.000Z`);
  return ttl < endOfDayKst ? ttl : endOfDayKst;
}

export function isExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

/** 남은 시간을 "1시간 20분" / "15분" / "곧 마감" 으로. */
export function remainingLabel(expiresAt: string | Date, now: Date = new Date()): string {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return '마감됨';
  const min = Math.floor(ms / 60_000);
  if (min < 1) return '곧 마감';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? (m > 0 ? `${h}시간 ${m}분` : `${h}시간`) : `${m}분`;
}
