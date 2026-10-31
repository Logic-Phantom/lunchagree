// 하드 조건 필터. 못 먹는 것·예산·걷기 한도는 자동으로 완화하지 않는다(프롬프트 §6).
// 모르는 값(가격·좌표·종류)은 통과시키되 '미확인'으로 표시한다 — 없는 정보를 지어내지 않는다.
import { estimateWalkMinutes, haversineMeters } from './distance.ts';
import { CANNOT_EAT } from './lunch-policy.ts';
import type { BlockReason, Candidate, Evaluated, FilterResult, GroupConstraints, LatLng } from './types.ts';

export function excludedTags(cannotEat: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const id of cannotEat) for (const t of CANNOT_EAT.find((c) => c.id === id)?.exclude ?? []) out.add(t);
  return out;
}

function checkTags(cannotEat: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const id of cannotEat) for (const t of CANNOT_EAT.find((c) => c.id === id)?.check ?? []) out.add(t);
  return out;
}

export function evaluateCandidate(c: Candidate, origin: LatLng | null, cannotEat: readonly string[]): Evaluated {
  const distanceM = origin && c.lat != null && c.lng != null ? haversineMeters(origin, { lat: c.lat, lng: c.lng }) : null;
  const risky = checkTags(cannotEat);
  // 종류를 모르는 후보는 못 먹는 것이 하나라도 있으면 확인 필요
  const needsMenuCheck = cannotEat.length > 0 && (c.tags.length === 0 || c.tags.some((t) => risky.has(t)));
  return {
    candidate: c,
    distanceM,
    walkMin: distanceM == null ? null : estimateWalkMinutes(distanceM),
    needsMenuCheck,
    priceKnown: c.priceHint != null,
  };
}

export function filterCandidates(candidates: readonly Candidate[], group: GroupConstraints, origin: LatLng | null): FilterResult {
  const excluded = excludedTags(group.cannotEat);
  const blocked: Record<BlockReason, number> = { cannotEat: 0, budget: 0, distance: 0 };
  const passed: Evaluated[] = [];
  for (const c of candidates) {
    const e = evaluateCandidate(c, origin, group.cannotEat);
    // 막힌 이유는 우선순위 한 가지로만 센다(못 먹는 것 > 예산 > 거리)
    if (c.tags.some((t) => excluded.has(t))) blocked.cannotEat += 1;
    else if (group.budgetCap != null && c.priceHint != null && c.priceHint > group.budgetCap) blocked.budget += 1;
    else if (group.walkCap != null && e.walkMin != null && e.walkMin > group.walkCap) blocked.distance += 1;
    else passed.push(e);
  }
  return { passed, blocked };
}
