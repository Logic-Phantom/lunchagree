// 직선거리(Haversine)와 도보 시간 추정. 경로 탐색은 하지 않는다 → 화면에는 항상 "약 N분(추정)".
import { WALK_DETOUR_FACTOR, WALK_METERS_PER_MIN } from './lunch-policy.ts';
import type { LatLng } from './types.ts';

const EARTH_RADIUS_M = 6_371_008.8;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 직선거리 × 1.3 ÷ 75m/분, 올림(최소 1분). */
export function estimateWalkMinutes(straightMeters: number): number {
  return Math.max(1, Math.ceil((straightMeters * WALK_DETOUR_FACTOR) / WALK_METERS_PER_MIN));
}
