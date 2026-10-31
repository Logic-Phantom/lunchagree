// 정적 후보 샤드(GitHub Pages) 읽기. 카카오·네이버 API는 쓰지 않는다(저장 금지 약관 — docs/PLACE_DATA_POLICY.md).
// VITE_PLACES_BASE_URL이 비어 있으면(데이터 빌드 전) 'unavailable'을 돌려주고, 화면은 '직접 추가'만 안내한다.
import type { LatLng, Place } from '../domain';

export interface NearbyPlaces {
  status: 'ok';
  station: LatLng;
  baseDate: string;
  places: Place[];
}
export type NearbyResult = NearbyPlaces | { status: 'unavailable' } | { status: 'error' };

const BASE = (import.meta.env.VITE_PLACES_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const TIMEOUT_MS = 1800; // 2초 지연 금지(체크리스트) → 넘으면 실패로 보고 직접 추가 안내
const cache = new Map<string, NearbyResult>();

export function placesConfigured(): boolean {
  return BASE.length > 0;
}

function isPlace(x: unknown): x is Place {
  if (typeof x !== 'object' || x === null) return false;
  const p = x as Record<string, unknown>;
  return typeof p.id === 'string' && typeof p.name === 'string' && typeof p.lat === 'number' && typeof p.lng === 'number' && Array.isArray(p.tags);
}

export async function fetchNearbyPlaces(stationId: string): Promise<NearbyResult> {
  if (!placesConfigured()) return { status: 'unavailable' };
  if (!/^S\d{4}$/.test(stationId)) return { status: 'error' };
  const hit = cache.get(stationId);
  if (hit) return hit;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/v1/near/${stationId}.json`, { signal: ctrl.signal });
    if (res.status === 404) return { status: 'unavailable' };
    if (!res.ok) return { status: 'error' };
    const body = (await res.json()) as { station?: LatLng; baseDate?: string; places?: unknown[] };
    if (!body.station || typeof body.station.lat !== 'number') return { status: 'error' };
    const result: NearbyPlaces = {
      status: 'ok',
      station: body.station,
      baseDate: String(body.baseDate ?? ''),
      places: (body.places ?? []).filter(isPlace),
    };
    cache.set(stationId, result);
    return result;
  } catch {
    return { status: 'error' };
  } finally {
    clearTimeout(timer);
  }
}
