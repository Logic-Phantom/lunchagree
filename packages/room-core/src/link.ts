// 방 링크. 토스: intoss://<appName>/room?t=<토큰>, 브라우저: #/join?t=<토큰>. 링크에는 토큰만.
import { isValidToken } from './token.ts';

export function roomSchemePath(appName: string, token: string): string {
  return `intoss://${appName}/room?t=${token}`;
}

/** 스킴 URL·해시 URL·쿼리 문자열 어디서든 t= 토큰을 꺼내 검증한다. 실패 시 null. */
export function extractToken(input: string): string | null {
  const m = /[?&]t=([A-Za-z0-9_-]+)/.exec(input);
  const token = m?.[1] ?? null;
  return isValidToken(token) ? token : null;
}
