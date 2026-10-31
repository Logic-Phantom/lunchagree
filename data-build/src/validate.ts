// 빌드 검증: 필수 필드, Phase 0 게이트(측정 지점 반경 1km 후보 수 중앙값 ≥ 100, 종류 태그 확보율 ≥ 70%).
import { haversineMeters } from '../../app/src/domain/distance.ts';
import { PLACE_RADIUS_M } from '../../app/src/domain/lunch-policy.ts';
import { tilesAround } from '../../app/src/domain/tiles.ts';
import { COLUMNS, REQUIRED } from './column-map.ts';
import type { Place } from './transform.ts';

/** Phase 0 측정 지점: 점심 수요가 큰 업무지구 10곳(좌표는 reference-points.json의 공식 역사 좌표를 빌려 쓴다). 사용자 지정 시 교체. */
export const MEASURE_POINTS: { name: string; sido: string }[] = [
  ...['강남', '역삼', '선릉', '삼성', '여의도', '광화문', '시청', '을지로입구', '구로디지털단지'].map((name) => ({ name, sido: '서울' })),
  { name: '판교', sido: '경기' },
];

/** 이름이 같은 다른 지역 지점(대전 '시청' 등)과 섞이지 않게 시·도까지 맞춘다. */
export function findMeasurePoints<T extends { name: string; address: string }>(refs: T[]): T[] {
  return MEASURE_POINTS.map((m) => refs.find((r) => r.name === m.name && r.address.startsWith(m.sido))).filter((r): r is T => !!r);
}

export const GATE = { medianPerPoint: 100, tagCoverage: 0.7 } as const;

export function missingColumns(header: string[]): string[] {
  return REQUIRED.map((k) => COLUMNS[k]).filter((c) => !header.includes(c));
}

export function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 앱과 같은 방식(타일 → 반경 필터)으로 한 지점 주변 후보를 센다. */
export function placesNear(tiles: Map<string, Place[]>, center: { lat: number; lng: number }, radiusM = PLACE_RADIUS_M): Place[] {
  return tilesAround(center, radiusM).flatMap((k) => tiles.get(k) ?? []).filter((p) => haversineMeters(center, p) <= radiusM);
}

export interface GateResult {
  medianPerPoint: number;
  tagCoverage: number;
  pass: boolean;
}

export function checkGate(nearby: Place[][]): GateResult {
  const all = nearby.flat();
  const tagged = all.filter((p) => p.tags.length > 0).length;
  const medianPerPoint = median(nearby.map((l) => l.length));
  const tagCoverage = all.length ? tagged / all.length : 0;
  return { medianPerPoint, tagCoverage, pass: medianPerPoint >= GATE.medianPerPoint && tagCoverage >= GATE.tagCoverage };
}
