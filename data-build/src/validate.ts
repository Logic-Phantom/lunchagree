// 빌드 검증: 필수 컬럼, Phase 0 게이트(역별 후보 수 중앙값 ≥ 100, 종류 태그 확보율 ≥ 70%).
import { COLUMNS, REQUIRED } from './column-map.ts';
import type { Place } from './transform.ts';

export const GATE = { medianPerStation: 100, tagCoverage: 0.7 } as const;

export function missingColumns(header: string[]): string[] {
  return REQUIRED.map((k) => COLUMNS[k]).filter((c) => !header.includes(c));
}

export function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface GateResult {
  medianPerStation: number;
  tagCoverage: number;
  pass: boolean;
}

export function checkGate(shards: Map<string, Place[]>, focusStationIds: string[]): GateResult {
  const counts = focusStationIds.map((id) => shards.get(id)?.length ?? 0);
  const focused = focusStationIds.flatMap((id) => shards.get(id) ?? []);
  const tagged = focused.filter((p) => p.tags.length > 0).length;
  const medianPerStation = median(counts);
  const tagCoverage = focused.length ? tagged / focused.length : 0;
  return { medianPerStation, tagCoverage, pass: medianPerStation >= GATE.medianPerStation && tagCoverage >= GATE.tagCoverage };
}
