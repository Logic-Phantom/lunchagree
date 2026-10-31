// 추천 이유 문장. 개인을 특정하지 않는 그룹 수준 표현만 쓴다("4명 중 3명이 원한 한식").
import { BUDGET_OPTIONS, cannotEatLabel, tagLabel } from './lunch-policy.ts';
import type { BlockReason, Evaluated, GroupConstraints } from './types.ts';

export function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

export function walkLabel(walkMin: number | null): string {
  return walkMin == null ? '거리 미확인' : `약 ${walkMin}분 거리(추정)`;
}

export function buildReasons(e: Evaluated, group: GroupConstraints): string[] {
  const reasons: string[] = [];
  const liked = e.candidate.tags
    .map((t) => ({ t, n: group.likeCounts[t] ?? 0 }))
    .sort((a, b) => b.n - a.n)[0];
  if (liked && liked.n > 0) reasons.push(`${group.readyCount}명 중 ${liked.n}명이 원한 ${tagLabel(liked.t)}`);
  reasons.push(walkLabel(e.walkMin));
  reasons.push(e.priceKnown ? `${formatWon(e.candidate.priceHint!)}(직접 입력)` : '가격 미확인');
  if (e.needsMenuCheck) reasons.push('메뉴 확인 필요');
  return reasons;
}

/** 그룹 조건 칩: "그룹 상한 1만원", "해산물 제외", "걷기 10분 이내". */
export function groupSummaryChips(group: GroupConstraints): string[] {
  const chips: string[] = [];
  if (group.budgetCap != null) {
    const opt = BUDGET_OPTIONS.find((o) => o.value === group.budgetCap);
    chips.push(`그룹 상한 ${opt ? opt.label.replace(' 이하', '') : formatWon(group.budgetCap)}`);
  }
  for (const c of group.cannotEat) chips.push(`${cannotEatLabel(c)} 제외`);
  if (group.walkCap != null) chips.push(`걷기 ${group.walkCap}분 이내`);
  return chips;
}

const BLOCK_LABEL: Record<BlockReason, string> = {
  cannotEat: '못 먹는 음식',
  budget: '예산',
  distance: '걷기 한도',
};

/** 후보 부족 안내: 어떤 조건이 몇 곳을 막았는지(그룹 수준). */
export function blockedSummary(blocked: Record<BlockReason, number>): string[] {
  return (Object.keys(blocked) as BlockReason[])
    .filter((k) => blocked[k] > 0)
    .map((k) => `${BLOCK_LABEL[k]} 조건 때문에 ${blocked[k]}곳이 빠졌어요`);
}
