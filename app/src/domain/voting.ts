// 투표 집계는 room-core(서버와 같은 규칙)를 쓰고, 화면용 문장만 여기서 만든다.
import { outcomeOf, tallyVotes, type Tally, type Vote, type VoteOutcome } from '@jeomsimhabui/room-core';

export { outcomeOf, tallyVotes };
export type { Tally, Vote, VoteOutcome };

export function voteStatusLabel(voted: number, total: number): string {
  if (voted === 0) return '아직 아무도 투표하지 않았어요';
  if (voted >= total) return `${total}명 모두 투표했어요`;
  return `${voted}명이 투표했어요`;
}

/** 서버가 내려준 후보별 득표 수(Record)에서 결과를 만든다. */
export function outcomeFromCounts(counts: Record<string, number>, candidateIds: readonly string[]): VoteOutcome {
  const votes: Vote[] = [];
  for (const id of candidateIds) {
    for (let i = 0; i < (counts[id] ?? 0); i += 1) votes.push({ roomId: '', participantId: `${id}#${i}`, candidateId: id });
  }
  return outcomeOf(tallyVotes(votes, candidateIds));
}
