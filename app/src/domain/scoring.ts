// 소프트 선호 점수: 좋아하는 종류(참가자당 합 1 정규화) + 가까울수록 가점. 점수 숫자는 화면에 노출하지 않는다.
// 정렬: 점수 ↓ → 도보 분 ↑(모름은 뒤) → 이름 → id (결정적).
import { buildReasons } from './explanations.ts';
import { DEFAULT_WALK_SCALE_MIN, MAX_RECOMMENDATIONS, SCORE_WEIGHTS } from './lunch-policy.ts';
import type { Evaluated, GroupConstraints, Recommendation } from './types.ts';

export function likeScore(tags: readonly string[], group: GroupConstraints): number {
  if (group.readyCount === 0 || tags.length === 0) return 0;
  // 후보가 여러 태그를 가지면 가장 높은 태그 하나만(중복 가산 방지)
  const best = Math.max(0, ...tags.map((t) => group.likeWeights[t] ?? 0));
  return Math.min(1, best / group.readyCount);
}

export function distanceScore(walkMin: number | null, group: GroupConstraints): number {
  if (walkMin == null) return 0;
  const scale = group.walkCap ?? DEFAULT_WALK_SCALE_MIN;
  return Math.max(0, 1 - walkMin / Math.max(scale, 1));
}

export function rankCandidates(passed: readonly Evaluated[], group: GroupConstraints): Recommendation[] {
  const scored = passed.map((e) => ({
    ...e,
    score: SCORE_WEIGHTS.like * likeScore(e.candidate.tags, group) + SCORE_WEIGHTS.distance * distanceScore(e.walkMin, group),
    reasons: buildReasons(e, group),
  }));
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (a.walkMin ?? Number.POSITIVE_INFINITY) - (b.walkMin ?? Number.POSITIVE_INFINITY) ||
      a.candidate.name.localeCompare(b.candidate.name, 'ko') ||
      a.candidate.id.localeCompare(b.candidate.id),
  );
  return scored;
}

export function topRecommendations(ranked: readonly Recommendation[], limit = MAX_RECOMMENDATIONS): Recommendation[] {
  return ranked.slice(0, limit);
}
