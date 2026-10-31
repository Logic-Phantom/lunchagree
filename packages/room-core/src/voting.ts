// 투표 집계. (roomId, participantId)당 1표, 바꾸면 덮어쓴다. 동률은 자동으로 정하지 않는다.
import type { Vote } from './types.ts';

export interface Tally {
  counts: Map<string, number>;
  totalVotes: number;
  /** 최다 득표 후보들(득표 0이면 빈 배열). 2개 이상이면 동률. */
  leaders: string[];
  topCount: number;
}

/** 같은 참가자의 표가 여러 개면 마지막 것만 센다(서버 upsert와 같은 결과). */
export function tallyVotes(votes: readonly Vote[], candidateIds: readonly string[]): Tally {
  const latest = new Map<string, string>();
  for (const v of votes) latest.set(v.participantId, v.candidateId);
  const valid = new Set(candidateIds);
  const counts = new Map<string, number>(candidateIds.map((id) => [id, 0]));
  let totalVotes = 0;
  for (const cid of latest.values()) {
    if (!valid.has(cid)) continue;
    counts.set(cid, (counts.get(cid) ?? 0) + 1);
    totalVotes += 1;
  }
  const topCount = Math.max(0, ...counts.values());
  // 후보 순서(추천 순)를 유지해 결과가 매번 같게
  const leaders = topCount === 0 ? [] : candidateIds.filter((id) => counts.get(id) === topCount);
  return { counts, totalVotes, leaders, topCount };
}

export type VoteOutcome =
  | { kind: 'NO_VOTES' }
  | { kind: 'WINNER'; candidateId: string }
  | { kind: 'TIE'; candidateIds: string[] };

export function outcomeOf(tally: Tally): VoteOutcome {
  if (tally.leaders.length === 0) return { kind: 'NO_VOTES' };
  if (tally.leaders.length === 1) return { kind: 'WINNER', candidateId: tally.leaders[0] };
  return { kind: 'TIE', candidateIds: tally.leaders };
}
