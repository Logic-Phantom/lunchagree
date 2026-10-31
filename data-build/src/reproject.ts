// EPSG:5174(Korean 1985 / Modified Central Belt, Bessel) → WGS84. proj4(MIT).
// 정의는 EPSG 레지스트리 문자열 + 국내에서 쓰는 towgs84 7변수. Phase 0에서 알려진 주소 3곳 이상으로 오차(≤ 30m) 확인.
import proj4 from 'proj4';

export const EPSG_5174 =
  '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs ' +
  '+towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43';

const converter = proj4(EPSG_5174, 'WGS84');

export function toWgs84(x: number, y: number): { lat: number; lng: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x === 0 || y === 0) return null;
  const [lng, lat] = converter.forward([x, y]);
  // 대한민국 범위 밖이면 좌표 오류로 본다
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 33 || lat > 39 || lng < 124 || lng > 132) return null;
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}
