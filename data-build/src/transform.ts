// 원본 행 → 영업 중 Place. 필터(영업상태) · 좌표 변환 · 종류 태그. 순수 함수(테스트 대상).
import { COLUMNS, OPEN_STATUS_VALUES } from './column-map.ts';
import { SOURCE_CRS, toWgs84, type CrsName } from './reproject.ts';
import { tagFor } from './tag.ts';

export interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  tags: string[];
  tagSource: 'source' | 'estimated';
  baseDate: string;
}

export interface TransformStats {
  total: number;
  notOpen: number;
  noCoord: number;
  kept: number;
  tagFromSource: number;
}

export function isOpen(row: Record<string, string>): boolean {
  return OPEN_STATUS_VALUES.includes(row[COLUMNS.status] ?? '');
}

export function toPlaces(rows: Record<string, string>[], baseDate: string, crs: CrsName = SOURCE_CRS): { places: Place[]; stats: TransformStats } {
  const stats: TransformStats = { total: rows.length, notOpen: 0, noCoord: 0, kept: 0, tagFromSource: 0 };
  const places: Place[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!isOpen(row)) {
      stats.notOpen += 1;
      continue;
    }
    const pos = toWgs84(Number(row[COLUMNS.x]), Number(row[COLUMNS.y]), crs);
    if (!pos) {
      stats.noCoord += 1;
      continue;
    }
    const id = `P${row[COLUMNS.id]}`.slice(0, 64);
    if (seen.has(id)) continue; // 지역 파일 경계에서 중복 방지
    seen.add(id);
    const name = row[COLUMNS.name];
    const tag = tagFor(row[COLUMNS.businessType] || row[COLUMNS.sanitationType], name);
    if (tag.tagSource === 'source') stats.tagFromSource += 1;
    places.push({ id, name, address: row[COLUMNS.roadAddress] || row[COLUMNS.address] || '', ...pos, ...tag, baseDate });
    stats.kept += 1;
  }
  return { places, stats };
}
