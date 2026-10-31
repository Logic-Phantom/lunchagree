// 좌표계 실측 검증(Phase 0, D-031): 도로명주소가 역사 주소와 같은 음식점(역 안 매장)은 역 좌표 근처에 있어야 한다.
// 두 정의(EPSG:5174 / EPSG:2097)로 각각 변환해 역 좌표까지 거리 중앙값을 비교하고, 작은 쪽을 고른다.
// 역사 좌표(국가철도공단)는 역 중심점이고 역사 안 매장은 출구·환승통로에 흩어져 있어 100~200m 오차는 정상.
// 판정: 표본 20개 이상 · 좋은 쪽 중앙값 ≤ 200m · 두 정의 차이 ≥ 80m 일 때만 '확정'.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { COLUMNS } from './column-map.ts';
import { CRS_DEFS, toWgs84, type CrsName } from './reproject.ts';
import { haversineMeters as haversine } from '../../app/src/domain/distance.ts';
import { median } from './validate.ts';

const ROOT = resolve(import.meta.dirname, '..');

/** '서울특별시 강남구 강남대로 지하 396, 지하1층 (역삼동)' → '서울특별시강남구강남대로지하396' */
export function addressKey(address: string): string {
  return address.split(',')[0].replace(/\(.*?\)/g, '').replace(/\s+/g, '');
}

export interface CrsResult {
  samples: number;
  medianM: Record<CrsName, number>;
  best: CrsName | null;
  confirmed: boolean;
}

export function compareCrs(rows: Record<string, string>[], stations: { lat: number; lng: number; address: string }[]): CrsResult {
  const byAddr = new Map(stations.filter((s) => s.address).map((s) => [addressKey(s.address), s]));
  const dists: Record<CrsName, number[]> = { 'EPSG:5174': [], 'EPSG:2097': [] };
  for (const r of rows) {
    const st = byAddr.get(addressKey(r[COLUMNS.roadAddress] ?? ''));
    if (!st) continue;
    for (const crs of Object.keys(CRS_DEFS) as CrsName[]) {
      const p = toWgs84(Number(r[COLUMNS.x]), Number(r[COLUMNS.y]), crs);
      if (p) dists[crs].push(haversine(st, p));
    }
  }
  const medianM = { 'EPSG:5174': Math.round(median(dists['EPSG:5174'])), 'EPSG:2097': Math.round(median(dists['EPSG:2097'])) };
  const samples = dists['EPSG:5174'].length;
  const best = samples === 0 ? null : medianM['EPSG:5174'] <= medianM['EPSG:2097'] ? 'EPSG:5174' : 'EPSG:2097';
  const other = best === 'EPSG:5174' ? 'EPSG:2097' : 'EPSG:5174';
  const confirmed = !!best && samples >= 20 && medianM[best] <= 200 && medianM[other] - medianM[best] >= 80;
  return { samples, medianM, best, confirmed };
}

export function readNdjsonDir(dir: string): Record<string, string>[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ndjson') && !f.endsWith('.partial.ndjson'))
    .flatMap((f) => readFileSync(join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, string>));
}

if (import.meta.main) {
  const dir = readdirSync(join(ROOT, 'raw')).filter((f) => /^15154916_.*_\d{8}$/.test(f)).sort().at(-1);
  if (!dir) throw new Error('raw/15154916_일반음식점_YYYYMMDD/ 없음 — npm run fetch:api 먼저');
  // 기준점 = 역사 공식 좌표(reference-points.ts). 역 안 매장 주소가 역사 주소와 같다는 점만 이용한다
  const points = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'reference-points.json'), 'utf8')).points;
  const result = compareCrs(readNdjsonDir(join(ROOT, 'raw', dir)), points);
  mkdirSync(join(ROOT, 'out'), { recursive: true });
  writeFileSync(join(ROOT, 'out', 'crs-check.json'), JSON.stringify({ dir, ...result }, null, 2));
  console.log(result);
  console.log(result.confirmed ? `→ ${result.best} 확정: reproject.ts SOURCE_CRS를 맞추세요.` : '→ 판정 보류: 표본·차이가 부족해요(docs/DATA_SOURCES.md에 기록).');
}
