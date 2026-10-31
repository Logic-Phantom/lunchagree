// 토스 진입 링크(intoss://jeomsimhabui/room?t=…)를 앱 안 경로로 바꾼다. 검증 실패 시 null(홈 그대로).
import { extractToken } from '@jeomsimhabui/room-core';

export function entryTarget(schemeUrl: string): string | null {
  if (!/^intoss(-private)?:\/\/[a-z0-9-]+\/room\?/.test(schemeUrl)) return null;
  const token = extractToken(schemeUrl);
  return token ? `/join?t=${token}` : null;
}
