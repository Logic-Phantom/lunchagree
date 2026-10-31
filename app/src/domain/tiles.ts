// 격자 타일: 전국 음식점을 위도·경도 0.005° 칸(서울 기준 약 555m × 440m)으로 나눠 정적 파일로 둔다.
// 앱은 내 위치 반경 안에 걸치는 타일만 받는다. data-build도 이 파일을 그대로 써서 두 쪽 계산이 어긋나지 않게 한다.
import type { LatLng } from './types.ts';

export const TILE_DEG = 0.005;
const METERS_PER_DEG_LAT = 111_195;

export function tileKey(lat: number, lng: number): string {
  return `${Math.floor(lat / TILE_DEG)}_${Math.floor(lng / TILE_DEG)}`;
}

/** 중심에서 radiusM 안의 점을 담을 수 있는 모든 타일 키(경계 상자 기준). */
export function tilesAround(center: LatLng, radiusM: number): string[] {
  const dLat = radiusM / METERS_PER_DEG_LAT;
  const dLng = radiusM / (METERS_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180));
  const i0 = Math.floor((center.lat - dLat) / TILE_DEG);
  const i1 = Math.floor((center.lat + dLat) / TILE_DEG);
  const j0 = Math.floor((center.lng - dLng) / TILE_DEG);
  const j1 = Math.floor((center.lng + dLng) / TILE_DEG);
  const keys: string[] = [];
  for (let i = i0; i <= i1; i += 1) for (let j = j0; j <= j1; j += 1) keys.push(`${i}_${j}`);
  return keys;
}

/**
 * 타일 파일의 한 행(용량을 줄이려고 배열): [id, 이름, 위도, 경도, 종류태그('' 가능), 추정여부(0|1), 도로명주소]
 * 기준일은 타일 파일 머리에 한 번만 둔다.
 */
export type TileRow = [string, string, number, number, string, 0 | 1, string];

export interface TileFile {
  v: 1;
  baseDate: string;
  rows: TileRow[];
}
