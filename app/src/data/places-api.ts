// 내 주변 음식점: 정적 격자 타일(GitHub Pages)을 받아 내 위치 반경 안만 거른다. 카카오·네이버 API는 쓰지 않는다(D-007).
// 서버에 내 좌표를 보내지 않는다 — 받는 것은 타일 파일뿐이라 호스팅 쪽에는 대략 어느 칸을 봤는지(약 500m 단위)만 남는다(docs/PRIVACY.md).
// VITE_PLACES_BASE_URL이 비어 있으면(데이터 빌드 전) 'unavailable' → 화면은 '직접 추가'만 안내한다.
import {
  estimateWalkMinutes, haversineMeters, PLACE_RADIUS_M, tilesAround, type LatLng, type NearbyPlace, type Place, type TileFile,
} from '../domain';

export type NearbyResult =
  | { status: 'ok'; baseDate: string; places: NearbyPlace[] }
  | { status: 'unavailable' }
  | { status: 'error' };

const BASE = (import.meta.env.VITE_PLACES_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const TIMEOUT_MS = 1800; // 2초 지연 금지(체크리스트) → 넘으면 실패로 보고 직접 추가 안내
const tileCache = new Map<string, Promise<TileFile | null>>();

export function placesConfigured(): boolean {
  return BASE.length > 0;
}

async function loadTile(key: string, signal: AbortSignal): Promise<TileFile | null> {
  const hit = tileCache.get(key);
  if (hit) return hit;
  const p = fetch(`${BASE}/v1/tiles/${key}.json`, { signal }).then(async (res) => {
    if (res.status === 404) return { v: 1, baseDate: '', rows: [] } as TileFile; // 음식점 없는 칸
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as TileFile;
    return body?.v === 1 && Array.isArray(body.rows) ? body : null;
  });
  tileCache.set(key, p);
  p.catch(() => tileCache.delete(key));
  return p;
}

export function rowToPlace(row: TileFile['rows'][number], baseDate: string): Place {
  const [id, name, lat, lng, tag, estimated, address] = row;
  return { id, name, lat, lng, tags: tag ? [tag] : [], tagSource: estimated ? 'estimated' : 'source', address, baseDate };
}

export function withinRadius(places: Place[], center: LatLng, radiusM = PLACE_RADIUS_M): NearbyPlace[] {
  return places
    .map((place) => {
      const distanceM = haversineMeters(center, place);
      return { place, distanceM, walkMin: estimateWalkMinutes(distanceM) };
    })
    .filter((n) => n.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM || a.place.id.localeCompare(b.place.id));
}

export async function fetchNearbyPlaces(center: LatLng, radiusM = PLACE_RADIUS_M): Promise<NearbyResult> {
  if (!placesConfigured()) return { status: 'unavailable' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const tiles = await Promise.all(tilesAround(center, radiusM).map((k) => loadTile(k, ctrl.signal)));
    if (tiles.some((t) => t == null)) return { status: 'error' };
    const baseDate = tiles.find((t) => t!.baseDate)?.baseDate ?? '';
    const places = tiles.flatMap((t) => t!.rows.map((r) => rowToPlace(r, t!.baseDate)));
    return { status: 'ok', baseDate, places: withinRadius(places, center, radiusM) };
  } catch {
    return { status: 'error' };
  } finally {
    clearTimeout(timer);
  }
}
