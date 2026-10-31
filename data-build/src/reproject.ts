// 인허가 좌표(Bessel 중부원점 TM) → WGS84. proj4(MIT).
// 포털 문서는 "보정계수 안들어간 Bessel 중부원점TM(EPSG:5174)"라고 적었지만, '보정계수 안 들어간'은 보통 EPSG:2097(원점 경도 127°)을 뜻하고
// EPSG:5174는 원점 경도에 10.405" 보정이 들어간 정의다. 두 정의의 차이는 서울에서 동서 약 255m(도보 3~4분)라 그냥 고를 수 없다.
// → 두 정의를 모두 두고 verify-crs.ts가 실데이터(역사 안 음식점 vs 역 좌표)로 오차가 작은 쪽을 고른다(Phase 0, D-031).
import proj4 from 'proj4';

const TOWGS84 = '+towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43';
export const CRS_DEFS = {
  'EPSG:5174': `+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs ${TOWGS84}`,
  'EPSG:2097': `+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs ${TOWGS84}`,
} as const;
export type CrsName = keyof typeof CRS_DEFS;

/** 빌드에 쓰는 좌표계. verify-crs.ts 결과로 정한다(미확정이면 문서 표기를 따른다). */
export const SOURCE_CRS: CrsName = 'EPSG:5174';

const converters: Record<CrsName, { forward(xy: [number, number]): number[] }> = {
  'EPSG:5174': proj4(CRS_DEFS['EPSG:5174'], 'WGS84'),
  'EPSG:2097': proj4(CRS_DEFS['EPSG:2097'], 'WGS84'),
};

export function toWgs84(x: number, y: number, crs: CrsName = SOURCE_CRS): { lat: number; lng: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x === 0 || y === 0) return null;
  const [lng, lat] = converters[crs].forward([x, y]);
  // 대한민국 범위 밖이면 좌표 오류로 본다
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 33 || lat > 39 || lng < 124 || lng > 132) return null;
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}
