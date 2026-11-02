// 주변 음식점(실데이터는 도심 반경 1km에 2,500곳 이상)을 사람이 고를 수 있는 양으로 줄인다. 순수 TS.
// 추천은 방 후보와 같은 엔진(하드 필터 → 점수)을 기기 안에서 돌린다 — 위치·도보 분은 기기 밖으로 나가지 않는다(D-041).
// 조건에 맞는 곳이 적으면 적은 대로 돌려준다. 없는 식당으로 채우지 않는다.
import { filterCandidates } from './candidate-filter.ts';
import { MAP_MAX_PINS, MAP_RING_STEPS_M, PLACE_RADIUS_M, SUGGEST_PAGE_SIZE, SUGGEST_PER_TAG_MAX, SUGGEST_SKIP_TAGS_UNLESS_LIKED } from './lunch-policy.ts';
import { rankCandidates } from './scoring.ts';
import type { BlockReason, Candidate, GroupConstraints, LatLng, NearbyPlace, Recommendation } from './types.ts';

export interface NearbySuggestion {
  nearby: NearbyPlace;
  rec: Recommendation;
}

export interface NearbySuggestions {
  items: NearbySuggestion[];
  /** 조건을 통과한 전체 수. */
  total: number;
  /** 이번에 보여 준 곳과 이미 넘긴 곳을 뺀 나머지 수. */
  remaining: number;
  blocked: Record<BlockReason, number>;
}

function toCandidate(n: NearbyPlace): Candidate {
  const { place } = n;
  return {
    id: place.id, roomId: '', source: 'PUBLIC_DATA', placeId: place.id, name: place.name, address: place.address, lat: place.lat, lng: place.lng,
    tags: place.tags, priceHint: null, priceType: 'UNKNOWN', addedBy: '',
  };
}

function rankEligible(places: readonly NearbyPlace[], group: GroupConstraints, origin: LatLng, excludeIds?: ReadonlySet<string>) {
  const eligible = places.filter(({ place }) =>
    place.tags.length > 0 && !excludeIds?.has(place.id)
    && !place.tags.some((t) => SUGGEST_SKIP_TAGS_UNLESS_LIKED.includes(t) && !(group.likeCounts[t] > 0)),
  );
  const { passed, blocked } = filterCandidates(eligible.map(toCandidate), group, origin);
  const ranked = rankCandidates(passed, group);
  return { ordered: [...ranked.filter((r) => !r.needsMenuCheck), ...ranked.filter((r) => r.needsMenuCheck)], blocked };
}

/**
 * 그룹 조건으로 주변 음식점을 추천한다.
 * - 종류를 모르는 곳은 조건을 판단할 수 없어 추천에서 뺀다(검색·지도에서는 그대로 보인다).
 * - 카페는 아무도 원하지 않았으면 점심 추천에서 뺀다.
 * - '메뉴 확인 필요'가 아닌 곳을 먼저, 아무도 고르지 않은 종류는 한 번에 SUGGEST_PER_TAG_MAX곳까지만 보여 준다.
 */
export function suggestNearby(
  places: readonly NearbyPlace[], group: GroupConstraints, origin: LatLng, opts: { excludeIds?: ReadonlySet<string>; skipIds?: ReadonlySet<string>; limit?: number } = {},
): NearbySuggestions {
  const { skipIds, limit = SUGGEST_PAGE_SIZE } = opts;
  const byId = new Map(places.map((n) => [n.place.id, n]));
  const { ordered, blocked } = rankEligible(places, group, origin, opts.excludeIds);
  const unseen = ordered.filter((r) => !skipIds?.has(r.candidate.id));

  const picked: Recommendation[] = [];
  const perTag = new Map<string, number>();
  for (const r of unseen) {
    if (picked.length >= limit) break;
    const tag = r.candidate.tags[0];
    const n = perTag.get(tag) ?? 0;
    if (!(group.likeCounts[tag] > 0) && n >= SUGGEST_PER_TAG_MAX) continue;
    perTag.set(tag, n + 1);
    picked.push(r);
  }
  // 남은 종류가 적어 다 못 채웠으면 종류 제한 없이 채운다
  for (const r of unseen) {
    if (picked.length >= limit) break;
    if (!picked.includes(r)) picked.push(r);
  }
  return {
    items: picked.map((rec) => ({ rec, nearby: byId.get(rec.candidate.id)! })),
    total: ordered.length,
    remaining: unseen.length - picked.length,
    blocked,
  };
}

export interface RandomPick {
  pick: NearbySuggestion | null;
  /** 뽑는 데 쓴 곳의 수. */
  pool: number;
  blocked: Record<BlockReason, number>;
}

/**
 * 조건을 통과한 곳 중 하나를 고르게 뽑는다(D-051). 제외 규칙은 추천과 같고, 점수는 쓰지 않는다.
 * 먹고 싶은 종류를 골랐으면 그 종류 안에서, '메뉴 확인 필요'가 아닌 곳이 있으면 그 안에서 뽑는다. 직전에 뽑은 곳은 다른 곳이 있으면 피한다.
 */
export function pickRandomNearby(
  places: readonly NearbyPlace[], group: GroupConstraints, origin: LatLng, opts: { lastId?: string | null; random?: () => number } = {},
): RandomPick {
  const { lastId, random = Math.random } = opts;
  const { ordered, blocked } = rankEligible(places, group, origin);
  const prefer = (list: Recommendation[], test: (r: Recommendation) => boolean) => (list.some(test) ? list.filter(test) : list);
  const liked = prefer(ordered, (r) => r.candidate.tags.some((t) => group.likeCounts[t] > 0));
  const safe = prefer(liked, (r) => !r.needsMenuCheck);
  const pool = prefer(safe, (r) => r.candidate.id !== lastId);
  if (pool.length === 0) return { pick: null, pool: 0, blocked };
  const rec = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  return { pick: { rec, nearby: places.find((n) => n.place.id === rec.candidate.id)! }, pool: pool.length, blocked };
}

/** 지도에 그릴 곳: 가까운 순 max곳 + 항상 보여 줄 곳(방 후보). places는 가까운 순으로 정렬돼 있어야 한다. */
export function selectMapPlaces<T extends { nearby: NearbyPlace }>(pins: readonly T[], isPinned: (p: T) => boolean, max = MAP_MAX_PINS): T[] {
  return pins.filter((p, i) => i < max || isPinned(p));
}

/** 그린 곳이 다 들어오는 가장 작은 지도 반경(거리 링 단위). 곳이 적은 동네도 지도가 비어 보이지 않는다. */
export function mapViewRadius(distancesM: readonly number[], maxRadiusM = PLACE_RADIUS_M): number {
  const far = Math.max(0, ...distancesM);
  return MAP_RING_STEPS_M.find((m) => m >= far && m <= maxRadiusM) ?? maxRadiusM;
}

/** 같은 좌표(같은 건물)의 가게는 핀이 완전히 겹치므로 한 핀으로 묶는다. 순서는 입력 순서를 따른다. */
export function groupPinsByCoord<T extends { nearby: NearbyPlace }>(pins: readonly T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const p of pins) {
    const key = `${p.nearby.place.lat},${p.nearby.place.lng}`;
    const g = groups.get(key);
    if (g) g.push(p);
    else groups.set(key, [p]);
  }
  return [...groups.values()];
}
