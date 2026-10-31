import { describe, expect, it } from 'vitest';
import {
  canJoin, canTransition, computeExpiresAt, extractToken, generateShortCode, generateToken, hashToken, isExpired,
  isValidToken, kstDate, MAX_PARTICIPANTS, normalizeNickname, normalizeShortCode, outcomeOf, remainingLabel,
  roomSchemePath, tallyVotes, type Vote,
} from '../src/index.ts';

describe('token', () => {
  it('128bit base64url 토큰을 만들고 검증한다', () => {
    const t = generateToken();
    expect(t).toHaveLength(22);
    expect(isValidToken(t)).toBe(true);
    expect(isValidToken('short')).toBe(false);
    expect(isValidToken('a'.repeat(21) + '/')).toBe(false);
    expect(generateToken()).not.toBe(t);
  });

  it('해시는 64자 hex이고 같은 입력이면 같다', async () => {
    const h = await hashToken('abc');
    expect(h).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('짧은 코드는 헷갈리는 글자 없이 6자', () => {
    for (let i = 0; i < 50; i += 1) {
      const c = generateShortCode();
      expect(c).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);
    }
    expect(normalizeShortCode(' ab3-d4e ')).toBe('AB3D4E'); // 공백·하이픈 허용
    expect(normalizeShortCode('AB3D4')).toBe(null); // 5자
    expect(normalizeShortCode('ab3d4e')).toBe('AB3D4E');
    expect(normalizeShortCode('AB0D4E')).toBe(null); // 0 금지
  });
});

describe('expiry', () => {
  it('오전 생성 → 12시간 뒤가 자정 전이면 12시간 뒤', () => {
    const created = new Date('2026-10-30T00:00:00Z'); // KST 09:00
    expect(computeExpiresAt(created).toISOString()).toBe('2026-10-30T12:00:00.000Z'); // KST 21:00
  });

  it('오후 생성 → 당일 23:59 KST', () => {
    const created = new Date('2026-10-30T05:00:00Z'); // KST 14:00
    expect(computeExpiresAt(created).toISOString()).toBe('2026-10-30T14:59:00.000Z');
  });

  it('KST 자정 넘긴 새벽 생성은 그날 23:59가 아니라 12시간 뒤', () => {
    const created = new Date('2026-10-30T16:00:00Z'); // KST 10-31 01:00
    expect(kstDate(created)).toBe('2026-10-31');
    expect(computeExpiresAt(created).toISOString()).toBe('2026-10-31T04:00:00.000Z');
  });

  it('남은 시간 표기', () => {
    const now = new Date('2026-10-30T00:00:00Z');
    expect(remainingLabel('2026-10-30T01:20:00Z', now)).toBe('1시간 20분');
    expect(remainingLabel('2026-10-30T00:15:00Z', now)).toBe('15분');
    expect(remainingLabel('2026-10-29T00:15:00Z', now)).toBe('마감됨');
    expect(isExpired('2026-10-30T00:00:00Z', now)).toBe(true);
  });
});

describe('participant', () => {
  it('닉네임 규칙', () => {
    expect(normalizeNickname('  지민  ')).toBe('지민');
    expect(normalizeNickname('')).toBe(null);
    expect(normalizeNickname('가'.repeat(11))).toBe(null);
    expect(normalizeNickname('<script>')).toBe(null);
    expect(normalizeNickname(3)).toBe(null);
  });

  it('인원 상한과 상태 전이', () => {
    expect(canJoin(MAX_PARTICIPANTS - 1)).toBe(true);
    expect(canJoin(MAX_PARTICIPANTS)).toBe(false);
    expect(canTransition('COLLECTING', 'VOTING')).toBe(true);
    expect(canTransition('COLLECTING', 'DECIDED')).toBe(false);
    expect(canTransition('CLOSED', 'VOTING')).toBe(false);
  });
});

describe('voting', () => {
  const v = (p: string, c: string): Vote => ({ roomId: 'r', participantId: p, candidateId: c });

  it('참가자당 마지막 표만 센다', () => {
    const t = tallyVotes([v('a', 'x'), v('a', 'y'), v('b', 'y')], ['x', 'y']);
    expect(t.counts.get('x')).toBe(0);
    expect(t.counts.get('y')).toBe(2);
    expect(t.totalVotes).toBe(2);
    expect(outcomeOf(t)).toEqual({ kind: 'WINNER', candidateId: 'y' });
  });

  it('동률은 자동으로 정하지 않고 추천 순서대로 돌려준다', () => {
    const t = tallyVotes([v('a', 'y'), v('b', 'x')], ['x', 'y', 'z']);
    expect(outcomeOf(t)).toEqual({ kind: 'TIE', candidateIds: ['x', 'y'] });
  });

  it('후보 목록에 없는 표와 무투표', () => {
    expect(outcomeOf(tallyVotes([v('a', 'ghost')], ['x']))).toEqual({ kind: 'NO_VOTES' });
  });
});

describe('link', () => {
  it('스킴·해시 URL에서 토큰만 꺼낸다', () => {
    const t = generateToken();
    expect(roomSchemePath('jeomsimhabui', t)).toBe(`intoss://jeomsimhabui/room?t=${t}`);
    expect(extractToken(`intoss://jeomsimhabui/room?t=${t}`)).toBe(t);
    expect(extractToken(`https://x/#/join?foo=1&t=${t}`)).toBe(t);
    expect(extractToken('intoss://jeomsimhabui/room?t=bad')).toBe(null);
  });
});
