// 도메인 엔진(순수 TS). 화면은 이 모듈만 통해 추천을 계산한다.
import { filterCandidates } from './candidate-filter.ts';
import { MAX_RECOMMENDATIONS } from './lunch-policy.ts';
import { rankCandidates, topRecommendations } from './scoring.ts';
import type { Candidate, FilterResult, GroupConstraints, LatLng, Recommendation } from './types.ts';

export * from './types.ts';
export * from './lunch-policy.ts';
export * from './group-constraints.ts';
export * from './distance.ts';
export * from './candidate-filter.ts';
export * from './scoring.ts';
export * from './explanations.ts';
export * from './voting.ts';
export * from './tiles.ts';
export * from './external-map.ts';
export * from './nearby.ts';

export interface RecommendResult {
  top: Recommendation[];
  rest: Recommendation[];
  blocked: FilterResult['blocked'];
  /** 통과 후보가 추천 수보다 적음 → "후보가 부족해요" 안내. 가짜 후보로 채우지 않는다. */
  insufficient: boolean;
}

/** origin = 이 기기의 현재 위치(없으면 거리 미확인). 참가자마다 자기 위치 기준 도보 분을 본다. */
export function recommend(candidates: readonly Candidate[], group: GroupConstraints, origin: LatLng | null = null): RecommendResult {
  const { passed, blocked } = filterCandidates(candidates, group, origin);
  const ranked = rankCandidates(passed, group);
  const top = topRecommendations(ranked);
  return { top, rest: ranked.slice(top.length), blocked, insufficient: top.length < MAX_RECOMMENDATIONS };
}
