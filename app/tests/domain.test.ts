import { describe, expect, it } from 'vitest';
import {
  aggregatePreferences, blockedSummary, estimateWalkMinutes, filterCandidates, groupSummaryChips, haversineMeters,
  outcomeFromCounts, recommend, type Candidate, type Preference,
} from '../src/domain/index.ts';

const ORIGIN = { lat: 37.4979, lng: 127.0276 }; // 강남역 부근(테스트용 좌표)

/** 원점에서 북쪽으로 m미터 떨어진 좌표. */
function north(m: number) {
  return { lat: ORIGIN.lat + m / 111_195, lng: ORIGIN.lng };
}

let seq = 0;
function cand(name: string, tags: string[], opts: Partial<Candidate> & { m?: number } = {}): Candidate {
  const pos = opts.m != null ? north(opts.m) : { lat: null, lng: null };
  seq += 1;
  return {
    id: `c${seq}`, roomId: 'r', source: 'MANUAL', placeId: null, name, address: null, tags,
    priceHint: null, priceType: 'UNKNOWN', addedBy: 'p1', ...pos, ...opts,
  };
}

function pref(id: string, p: Partial<Preference>): Preference {
  return { participantId: id, maxBudget: null, likes: [], cannotEat: [], maxWalkMinutes: null, ...p };
}

describe('distance', () => {
  it('Haversine 1km ≈ 1000m, 도보 = 직선 × 1.3 ÷ 75 올림', () => {
    expect(haversineMeters(ORIGIN, north(1000))).toBeCloseTo(1000, -1);
    expect(estimateWalkMinutes(400)).toBe(7); // 520m / 75 = 6.93
    expect(estimateWalkMinutes(1)).toBe(1);
  });
});

describe('group constraints', () => {
  it('예산·걷기 = 최솟값, 못 먹는 것 = 합집합, 좋아요 = 참가자당 합 1', () => {
    const g = aggregatePreferences(
      [
        pref('a', { maxBudget: 12000, likes: ['korean', 'noodle'], cannotEat: ['seafood'], maxWalkMinutes: 15 }),
        pref('b', { maxBudget: 9000, likes: ['korean'], cannotEat: ['spicy'] }),
        pref('c', { likes: [] }),
      ],
      4,
    );
    expect(g.participantCount).toBe(4);
    expect(g.readyCount).toBe(3);
    expect(g.budgetCap).toBe(9000);
    expect(g.walkCap).toBe(15);
    expect(g.cannotEat).toEqual(['seafood', 'spicy']);
    expect(g.likeCounts).toEqual({ korean: 2, noodle: 1 });
    expect(g.likeWeights.korean).toBeCloseTo(1.5);
    expect(g.likeWeights.noodle).toBeCloseTo(0.5);
  });

  it('아무 조건이 없으면 상한 없음', () => {
    const g = aggregatePreferences([], 2);
    expect(g.budgetCap).toBe(null);
    expect(g.walkCap).toBe(null);
    expect(groupSummaryChips(g)).toEqual([]);
  });
});

describe('filter (하드 조건, 자동 완화 없음)', () => {
  const group = aggregatePreferences([pref('a', { maxBudget: 10000, cannotEat: ['seafood'], maxWalkMinutes: 10 })], 1);

  it('못 먹는 것 > 예산 > 거리 순으로 한 번만 센다', () => {
    const r = filterCandidates(
      [
        cand('횟집', ['seafood'], { m: 100 }),
        cand('비싼집', ['korean'], { m: 100, priceHint: 15000, priceType: 'USER_REPORTED' }),
        cand('먼집', ['korean'], { m: 900 }), // 900×1.3/75 = 15.6 → 16분
        cand('통과', ['korean'], { m: 300 }),
      ],
      group,
      ORIGIN,
    );
    expect(r.passed.map((e) => e.candidate.name)).toEqual(['통과']);
    expect(r.blocked).toEqual({ cannotEat: 1, budget: 1, distance: 1 });
    expect(blockedSummary(r.blocked)).toHaveLength(3);
  });

  it('가격·좌표를 모르면 막지 않고 미확인으로 남긴다', () => {
    const r = filterCandidates([cand('모름', ['korean'])], group, ORIGIN);
    expect(r.passed).toHaveLength(1);
    expect(r.passed[0].walkMin).toBe(null);
    expect(r.passed[0].priceKnown).toBe(false);
  });

  it('못 먹는 것이 있으면 위험 종류·종류 미상은 "메뉴 확인 필요"', () => {
    const r = filterCandidates([cand('한식', ['korean'], { m: 100 }), cand('카페', ['cafe'], { m: 100 }), cand('미상', [], { m: 100 })], group, ORIGIN);
    const flags = Object.fromEntries(r.passed.map((e) => [e.candidate.name, e.needsMenuCheck]));
    expect(flags).toEqual({ 한식: true, 카페: false, 미상: true });
  });
});

describe('recommend', () => {
  it('좋아하는 종류가 우선, 같으면 가까운 순, 이유 문장은 그룹 수준', () => {
    const group = aggregatePreferences(
      [pref('a', { likes: ['korean'] }), pref('b', { likes: ['korean'] }), pref('c', { likes: ['japanese'] }), pref('d', {})],
      4,
    );
    const r = recommend(
      [cand('먼한식', ['korean'], { m: 400 }), cand('가까운한식', ['korean'], { m: 200 }), cand('일식', ['japanese'], { m: 100 }), cand('분식', ['snack'], { m: 50 })],
      group,
      ORIGIN,
    );
    expect(r.top.map((x) => x.candidate.name)).toEqual(['가까운한식', '먼한식', '일식']);
    expect(r.top[0].reasons[0]).toBe('4명 중 2명이 원한 한식');
    expect(r.top[0].reasons).toContain('가격 미확인');
    expect(r.top[0].reasons.join(' ')).not.toMatch(/점수|\d+\.\d+/); // 점수 숫자 노출 금지
    expect(r.rest.map((x) => x.candidate.name)).toEqual(['분식']);
    expect(r.insufficient).toBe(false);
  });

  it('후보가 부족하면 부족하다고 알리고, 가짜 후보를 만들지 않는다', () => {
    const group = aggregatePreferences([pref('a', { cannotEat: ['seafood'] })], 2);
    const input = [cand('횟집', ['seafood']), cand('한식', ['korean'])];
    const r = recommend(input, group, null);
    expect(r.top).toHaveLength(1);
    expect(r.insufficient).toBe(true);
    const ids = new Set(input.map((c) => c.id));
    expect([...r.top, ...r.rest].every((x) => ids.has(x.candidate.id))).toBe(true);
  });

  it('후보 0개 → 빈 결과', () => {
    const r = recommend([], aggregatePreferences([], 2), ORIGIN);
    expect(r.top).toEqual([]);
    expect(r.insufficient).toBe(true);
  });

  it('동점이면 이름순으로 결정적', () => {
    const group = aggregatePreferences([], 2);
    const r = recommend([cand('나', []), cand('가', [])], group, null);
    expect(r.top.map((x) => x.candidate.name)).toEqual(['가', '나']);
  });
});

describe('voting', () => {
  it('득표 수에서 승자·동률을 낸다', () => {
    expect(outcomeFromCounts({ a: 2, b: 1 }, ['a', 'b'])).toEqual({ kind: 'WINNER', candidateId: 'a' });
    expect(outcomeFromCounts({ a: 1, b: 1 }, ['a', 'b'])).toEqual({ kind: 'TIE', candidateIds: ['a', 'b'] });
    expect(outcomeFromCounts({}, ['a'])).toEqual({ kind: 'NO_VOTES' });
  });
});
