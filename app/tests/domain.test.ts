import { describe, expect, it } from 'vitest';
import {
  aggregatePreferences, blockedSummary, estimateWalkMinutes, filterCandidates, groupPinsByCoord, groupSummaryChips, haversineMeters,
  kakaoMapSearchUrl, mapSearchQuery, mapViewRadius, MAP_MAX_PINS, naverMapSearchUrl, outcomeFromCounts, pickRandomNearby, recommend, selectMapPlaces, suggestNearby, tileKey, tilesAround,
  type Candidate, type NearbyPlace, type Preference, type TileFile,
} from '../src/domain/index.ts';
import { rowToPlace, withinRadius } from '../src/data/places-api.ts';


function pref(id: string, p: Partial<Preference>): Preference {
  return { participantId: id, maxBudget: null, likes: [], cannotEat: [], maxWalkMinutes: null, ...p };
}

const ME = { lat: 37.4977, lng: 127.0279 };
const north = (m: number) => ({ lat: ME.lat + m / 111_195, lng: ME.lng });

let seq = 0;
/** m: 내 위치(ME)에서 북쪽으로 몇 m 떨어진 식당인지(공개 좌표). 없으면 좌표 없는 직접 입력 후보. */
function cand(name: string, tags: string[], opts: Partial<Candidate> & { m?: number } = {}): Candidate {
  seq += 1;
  const { m, ...rest } = opts;
  const pos = m != null ? north(m) : { lat: null, lng: null };
  return {
    id: `c${seq}`, roomId: 'r', source: 'MANUAL', placeId: null, name, address: null, tags,
    priceHint: null, priceType: 'UNKNOWN', addedBy: 'p1', ...pos, ...rest,
  };
}

describe('distance', () => {
  it('Haversine 1km ≈ 1000m, 도보 = 직선 × 1.3 ÷ 75 올림', () => {
    expect(haversineMeters(ME, north(1000))).toBeCloseTo(1000, -1);
    expect(estimateWalkMinutes(400)).toBe(7); // 520m / 75 = 6.93
    expect(estimateWalkMinutes(1)).toBe(1);
  });
});

describe('내 주변(타일 → 반경)', () => {
  it('반경 1km 타일 목록에 내 칸이 들어 있고, 타일 행을 풀어 반경 안만 가까운 순으로', () => {
    expect(tilesAround(ME, 1000)).toContain(tileKey(ME.lat, ME.lng));
    const tile: TileFile = {
      v: 1,
      baseDate: '2026-10-31',
      rows: [
        ['P1', '먼집', north(1200).lat, ME.lng, 'korean', 0, '서울'],
        ['P2', '가까운집', north(100).lat, ME.lng, '', 1, '서울'],
        ['P3', '중간집', north(800).lat, ME.lng, 'noodle', 0, '서울'],
      ],
    };
    const near = withinRadius(tile.rows.map((r) => rowToPlace(r, tile.baseDate)), ME);
    expect(near.map((n) => n.place.name)).toEqual(['가까운집', '중간집']);
    expect(near[0].place.tags).toEqual([]);
    expect(near[0].place.tagSource).toBe('estimated');
    expect(near[1].walkMin).toBe(estimateWalkMinutes(near[1].distanceM));
  });
});

describe('지도 앱 링크(영업시간 확인용)', () => {
  it('검색어 = 상호 + 시군구 도로명, URL 인코딩', () => {
    expect(mapSearchQuery('할매국밥', '서울특별시 강남구 강남대로 396, 1층 (역삼동)')).toBe('할매국밥 강남구 강남대로');
    expect(mapSearchQuery('할매국밥', null)).toBe('할매국밥');
    expect(kakaoMapSearchUrl('할매국밥', null)).toBe(`https://map.kakao.com/link/search/${encodeURIComponent('할매국밥')}`);
    expect(naverMapSearchUrl('A&B', null)).toBe('https://map.naver.com/p/search/A%26B');
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
        cand('먼집', ['korean'], { m: 900 }),
        cand('통과', ['korean'], { m: 320 }),
      ],
      group,
      ME,
    );
    expect(r.passed.map((e) => e.candidate.name)).toEqual(['통과']);
    expect(r.blocked).toEqual({ cannotEat: 1, budget: 1, distance: 1 });
    expect(blockedSummary(r.blocked)).toHaveLength(3);
  });

  it('가격·거리를 모르면 막지 않고 미확인으로 남긴다', () => {
    const r = filterCandidates([cand('모름', ['korean'])], group, ME);
    expect(r.passed).toHaveLength(1);
    expect(r.passed[0].walkMin).toBe(null);
    expect(r.passed[0].priceKnown).toBe(false);
  });

  it('못 먹는 것이 있으면 위험 종류·종류 미상은 "메뉴 확인 필요"', () => {
    const r = filterCandidates([cand('한식', ['korean']), cand('카페', ['cafe']), cand('미상', [])], group);
    const flags = Object.fromEntries(r.passed.map((e) => [e.candidate.name, e.needsMenuCheck]));
    expect(flags).toEqual({ 한식: true, 카페: false, 미상: true });
  });
});

describe('위치는 기기에서만(D-041)', () => {
  it('같은 후보도 보는 사람 위치마다 도보 분이 다르고, 위치를 모르면 미확인', () => {
    const c = cand('식당', ['korean'], { m: 400 });
    const g = aggregatePreferences([], 1);
    expect(recommend([c], g, ME).top[0].walkMin).toBe(7);
    expect(recommend([c], g, north(400)).top[0].walkMin).toBe(1);
    expect(recommend([c], g, null).top[0].walkMin).toBe(null);
  });

  it('서버로 보내는 후보에는 식당 공개 좌표만 — 사용자 위치·도보 분 필드가 없다', async () => {
    const { nearbyToCandidate } = await import('../src/features/candidates/AddCandidateSheet.tsx');
    const near = withinRadius([rowToPlace(['P9', '식당', north(300).lat, ME.lng, 'korean', 0, '서울'], '2026-10-31')], ME)[0];
    const sent = nearbyToCandidate(near);
    expect(Object.keys(sent).sort()).toEqual(['address', 'lat', 'lng', 'name', 'placeId', 'priceHint', 'source', 'tags']);
    expect(sent.lat).toBe(near.place.lat); // 식당 좌표
    expect(JSON.stringify(sent)).not.toContain(String(ME.lat));
  });
});

describe('recommend', () => {
  it('좋아하는 종류가 우선, 같으면 가까운 순, 이유 문장은 그룹 수준', () => {
    const group = aggregatePreferences(
      [pref('a', { likes: ['korean'] }), pref('b', { likes: ['korean'] }), pref('c', { likes: ['japanese'] }), pref('d', {})],
      4,
    );
    const r = recommend(
      [
        cand('먼한식', ['korean'], { m: 400 }),
        cand('가까운한식', ['korean'], { m: 220 }),
        cand('일식', ['japanese'], { m: 100 }),
        cand('분식', ['snack'], { m: 50 }),
      ],
      group,
      ME,
    );
    expect(r.top.map((x) => x.candidate.name)).toEqual(['가까운한식', '먼한식', '일식']);
    expect(r.top[0].reasons[0]).toBe('4명 중 2명이 원한 한식');
    expect(r.top[0].reasons).toContain('가격 미확인');
    expect(r.top[0].reasons).toContain('약 4분 거리(추정)');
    expect(r.top[0].reasons.join(' ')).not.toMatch(/점수|\d+\.\d+/); // 점수 숫자 노출 금지
    expect(r.rest.map((x) => x.candidate.name)).toEqual(['분식']);
    expect(r.insufficient).toBe(false);
  });

  it('후보가 부족하면 부족하다고 알리고, 가짜 후보를 만들지 않는다', () => {
    const group = aggregatePreferences([pref('a', { cannotEat: ['seafood'] })], 2);
    const input = [cand('횟집', ['seafood']), cand('한식', ['korean'])];
    const r = recommend(input, group);
    expect(r.top).toHaveLength(1);
    expect(r.insufficient).toBe(true);
    const ids = new Set(input.map((c) => c.id));
    expect([...r.top, ...r.rest].every((x) => ids.has(x.candidate.id))).toBe(true);
  });

  it('후보 0개 → 빈 결과', () => {
    const r = recommend([], aggregatePreferences([], 2));
    expect(r.top).toEqual([]);
    expect(r.insufficient).toBe(true);
  });

  it('동점이면 이름순으로 결정적', () => {
    const r = recommend([cand('나', []), cand('가', [])], aggregatePreferences([], 2));
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

describe('내 주변 추천·지도(실데이터 규모)', () => {
  const near = (id: string, tags: string[], m: number, lat = north(m).lat, lng = ME.lng): NearbyPlace => ({
    place: { id, name: `테스트${id}`, address: '테스트로 1', lat, lng, tags, tagSource: 'source', baseDate: '2026-01-01' },
    distanceM: m,
    walkMin: estimateWalkMinutes(m),
  });
  const group = (prefs: Partial<Preference>[] = [{}]) => aggregatePreferences(prefs.map((p, i) => pref(`p${i}`, p)), prefs.length);
  const ids = (r: { items: { nearby: NearbyPlace }[] }) => r.items.map((i) => i.nearby.place.id);

  it('종류 모르는 곳·방에 있는 곳·아무도 원하지 않은 카페는 추천하지 않고, 부족하면 있는 만큼만 준다', () => {
    const places = [near('a', [], 10), near('b', ['cafe'], 20), near('c', ['korean'], 30), near('d', ['western'], 40)];
    const r = suggestNearby(places, group(), ME, { excludeIds: new Set(['d']) });
    expect(ids(r)).toEqual(['c']);
    expect(r.total).toBe(1);
  });

  it('누군가 카페를 원하면 추천에 넣고, 원한 종류를 앞세운다', () => {
    const places = [near('k', ['korean'], 10), near('c', ['cafe'], 300)];
    expect(ids(suggestNearby(places, group([{ likes: ['cafe'] }]), ME))).toEqual(['c', 'k']);
  });

  it('못 먹는 것·걷기 한도는 완화하지 않고 막힌 수를 알려 준다', () => {
    const places = [near('s', ['seafood'], 10), near('f', ['korean'], 900), near('o', ['western'], 100)];
    const r = suggestNearby(places, group([{ cannotEat: ['seafood'], maxWalkMinutes: 5 }]), ME);
    expect(ids(r)).toEqual(['o']);
    expect(r.blocked).toMatchObject({ cannotEat: 1, distance: 1 });
  });

  it("'메뉴 확인 필요'가 아닌 곳을 먼저 보여 주고 뺀 곳에 표시를 남긴다", () => {
    const places = [near('k', ['korean'], 10), near('w', ['western'], 500)];
    const r = suggestNearby(places, group([{ cannotEat: ['spicy'] }]), ME);
    expect(ids(r)).toEqual(['w', 'k']);
    expect(r.items[1].rec.needsMenuCheck).toBe(true);
  });

  it('아무도 고르지 않은 종류가 한 번에 몰리지 않고, 넘긴 곳은 다시 나오지 않으며 나머지 수가 맞다', () => {
    const places = [...Array.from({ length: 10 }, (_, i) => near(`k${i}`, ['korean'], i)), near('w', ['western'], 800), near('n', ['noodle'], 900)];
    const first = suggestNearby(places, group(), ME);
    expect(ids(first).filter((x) => x.startsWith('k'))).toHaveLength(3); // 종류 제한 2 + 남은 칸 채움
    expect(ids(first)).toEqual(expect.arrayContaining(['w', 'n']));
    const second = suggestNearby(places, group(), ME, { skipIds: new Set(ids(first)) });
    expect(ids(second).some((x) => ids(first).includes(x))).toBe(false);
    expect(second.remaining).toBe(12 - 5 - 5);
  });

  it('랜덤 뽑기: 조건을 통과한 곳에서만 고르게 뽑고, 없으면 만들지 않는다', () => {
    const places = [near('a', ['korean'], 10), near('b', ['western'], 20), near('c', ['seafood'], 30), near('u', [], 40), near('f', ['noodle'], 900)];
    const g = group([{ cannotEat: ['raw'], maxWalkMinutes: 5 }]);
    const seen = new Set<string>();
    for (let i = 0; i < 20; i += 1) seen.add(pickRandomNearby(places, g, ME, { random: () => i / 20 }).pick!.nearby.place.id);
    expect([...seen].sort()).toEqual(['a', 'b']);
    expect(pickRandomNearby(places, g, ME).pool).toBe(2);
    const none = pickRandomNearby([near('c', ['seafood'], 30)], g, ME);
    expect(none.pick).toBeNull();
    expect(none.blocked.cannotEat).toBe(1);
    expect(pickRandomNearby([], g, ME).pick).toBeNull();
  });

  it('랜덤 뽑기: 먹고 싶은 종류를 앞세우고, 직전에 뽑은 곳은 다른 곳이 있으면 피한다', () => {
    const places = [near('k', ['korean'], 10), near('w1', ['western'], 20), near('w2', ['western'], 30)];
    const g = group([{ likes: ['western'] }]);
    expect(pickRandomNearby(places, g, ME, { random: () => 0.99 }).pick!.nearby.place.id).toBe('w2');
    expect(pickRandomNearby(places, g, ME, { random: () => 0.99, lastId: 'w2' }).pick!.nearby.place.id).toBe('w1');
    expect(pickRandomNearby([near('k', ['korean'], 10)], group(), ME, { lastId: 'k' }).pick!.nearby.place.id).toBe('k');
  });

  it('지도 핀은 가까운 곳으로 제한하되 방 후보는 멀어도 남고, 반경은 그린 곳에 맞춘다', () => {
    const pins = Array.from({ length: 2500 }, (_, i) => ({ nearby: near(`p${i}`, ['korean'], i * 0.4), inRoom: i === 2400 }));
    const shown = selectMapPlaces(pins, (p) => p.inRoom);
    expect(shown).toHaveLength(MAP_MAX_PINS + 1);
    expect(shown.at(-1)!.nearby.place.id).toBe('p2400');
    expect(mapViewRadius(shown.slice(0, MAP_MAX_PINS).map((p) => p.nearby.distanceM))).toBe(250);
    expect(mapViewRadius(shown.map((p) => p.nearby.distanceM))).toBe(1000);
    expect(mapViewRadius([])).toBe(250);
    expect(mapViewRadius([300], 200)).toBe(200);
  });

  it('같은 좌표의 가게는 한 핀으로 묶는다', () => {
    const a = { nearby: near('a', [], 10, 37.5, 127) };
    const b = { nearby: near('b', [], 10, 37.5, 127) };
    const c = { nearby: near('c', [], 20, 37.6, 127) };
    expect(groupPinsByCoord([a, b, c]).map((g) => g.length)).toEqual([2, 1]);
  });
});
