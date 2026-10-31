// 각자 조건 → 그룹 조건. 서버 get_room_state의 'group'과 같은 규칙(docs/CONSENSUS_ALGORITHM.md).
import type { GroupConstraints, Preference } from './types.ts';

function minOrNull(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number');
  return nums.length ? Math.min(...nums) : null;
}

export function aggregatePreferences(prefs: readonly Preference[], participantCount: number): GroupConstraints {
  const cannotEat = new Set<string>();
  const likeCounts: Record<string, number> = {};
  const likeWeights: Record<string, number> = {};
  for (const p of prefs) {
    for (const c of p.cannotEat) cannotEat.add(c);
    const likes = Array.from(new Set(p.likes));
    for (const tag of likes) {
      likeCounts[tag] = (likeCounts[tag] ?? 0) + 1;
      likeWeights[tag] = (likeWeights[tag] ?? 0) + 1 / likes.length;
    }
  }
  return {
    participantCount: Math.max(participantCount, prefs.length),
    readyCount: prefs.length,
    budgetCap: minOrNull(prefs.map((p) => p.maxBudget)),
    walkCap: minOrNull(prefs.map((p) => p.maxWalkMinutes)),
    cannotEat: Array.from(cannotEat).sort(),
    likeCounts,
    likeWeights,
  };
}
