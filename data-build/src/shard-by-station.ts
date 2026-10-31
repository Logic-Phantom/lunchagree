// 역별 반경 1km 후보 샤드. 격자 버킷으로 후보를 좁혀 역 600개 × 음식점 수십만 개도 빠르게 처리.
import type { Place } from './transform.ts';

export const RADIUS_M = 1000; // app/src/domain/lunch-policy.ts PLACE_RADIUS_M와 같게
const R = 6_371_008.8;

export interface StationCoord {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const CELL = 0.01; // 위도 약 1.1km
const cellKey = (lat: number, lng: number) => `${Math.floor(lat / CELL)}:${Math.floor(lng / CELL)}`;

export function shardByStation(stations: StationCoord[], places: Place[]): Map<string, Place[]> {
  const grid = new Map<string, Place[]>();
  for (const p of places) {
    const k = cellKey(p.lat, p.lng);
    const list = grid.get(k);
    if (list) list.push(p);
    else grid.set(k, [p]);
  }
  const out = new Map<string, Place[]>();
  for (const s of stations) {
    const ci = Math.floor(s.lat / CELL);
    const cj = Math.floor(s.lng / CELL);
    const near: { p: Place; d: number }[] = [];
    for (let i = ci - 1; i <= ci + 1; i += 1) {
      for (let j = cj - 2; j <= cj + 2; j += 1) {
        for (const p of grid.get(`${i}:${j}`) ?? []) {
          const d = haversine(s, p);
          if (d <= RADIUS_M) near.push({ p, d });
        }
      }
    }
    near.sort((a, b) => a.d - b.d || a.p.id.localeCompare(b.p.id));
    out.set(s.id, near.map((x) => x.p));
  }
  return out;
}
