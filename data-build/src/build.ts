// 데이터 빌드: raw/15154916_일반음식점_YYYYMMDD/*.ndjson(API 수집본) → 영업 필터 → 좌표 변환 → 태그 → 격자 타일 → out/v1/ (GitHub Pages 배포 대상)
//   out/v1/meta.json              { baseDate, tileDeg, places, tiles }
//   out/v1/tiles/{i}_{j}.json     { v, baseDate, rows: TileRow[] }  (app/src/domain/tiles.ts)
// 사용: npm run data:build   (필요: npm run fetch:api)
// 실패 시 exit 1 → data-build.yml은 이전 Pages 산출물을 그대로 둔다.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { TILE_DEG, tileKey, type TileFile, type TileRow } from '../../app/src/domain/tiles.ts';
import { SOURCE_CRS } from './reproject.ts';
import type { RefPoint } from './reference-points.ts';
import { toPlaces, type Place } from './transform.ts';
import { checkGate, findMeasurePoints, missingColumns, placesNear } from './validate.ts';
import { readNdjsonDir } from './verify-crs.ts';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'out', 'v1');

export function buildTiles(places: Place[]): Map<string, Place[]> {
  const tiles = new Map<string, Place[]>();
  for (const p of places) {
    const k = tileKey(p.lat, p.lng);
    const list = tiles.get(k);
    if (list) list.push(p);
    else tiles.set(k, [p]);
  }
  return tiles;
}

export function toTileRow(p: Place): TileRow {
  return [p.id, p.name, Math.round(p.lat * 1e5) / 1e5, Math.round(p.lng * 1e5) / 1e5, p.tags[0] ?? '', p.tagSource === 'estimated' ? 1 : 0, p.address];
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (import.meta.main) {
  const dir = existsSync(join(ROOT, 'raw')) ? readdirSync(join(ROOT, 'raw')).filter((f) => /^15154916_.*_(\d{8})$/.test(f)).sort().at(-1) : undefined;
  if (!dir) fail('raw/15154916_일반음식점_YYYYMMDD/ 수집본이 없어요. npm run fetch:api (DATA_GO_KR_KEY 필요).');
  const baseDate = dir.match(/_(\d{4})(\d{2})(\d{2})$/)!.slice(1).join('-');

  const rows = readNdjsonDir(join(ROOT, 'raw', dir));
  const missing = missingColumns(Object.keys(rows[0] ?? {}));
  if (missing.length) fail(`필수 필드 없음: ${missing.join(', ')} → src/column-map.ts를 실제 필드명으로 고쳐요.`);

  const { places, stats } = toPlaces(rows, baseDate);
  const tiles = buildTiles(places);

  rmSync(join(OUT, 'tiles'), { recursive: true, force: true });
  mkdirSync(join(OUT, 'tiles'), { recursive: true });
  for (const [k, list] of tiles) {
    const file: TileFile = { v: 1, baseDate, rows: list.map(toTileRow) };
    writeFileSync(join(OUT, 'tiles', `${k}.json`), JSON.stringify(file));
  }
  writeFileSync(join(OUT, 'meta.json'), JSON.stringify({ baseDate, tileDeg: TILE_DEG, crs: SOURCE_CRS, places: places.length, tiles: tiles.size }));

  // Phase 0 게이트(측정 지점 좌표가 있을 때만)
  let gate = null;
  let measured: { name: string; count: number }[] = [];
  const refFile = join(ROOT, 'fixtures', 'reference-points.json');
  if (existsSync(refFile)) {
    const refs = (JSON.parse(readFileSync(refFile, 'utf8')) as { points: RefPoint[] }).points;
    const pts = findMeasurePoints(refs);
    const near = pts.map((p) => placesNear(tiles, p));
    gate = checkGate(near);
    measured = pts.map((p, i) => ({ name: p.name, count: near[i].length }));
  }
  writeFileSync(join(ROOT, 'out', 'report.json'), JSON.stringify({ source: dir, baseDate, crs: SOURCE_CRS, stats, tiles: tiles.size, gate, measured }, null, 2));
  console.log(`✓ ${stats.kept}/${stats.total} 영업 중 · 타일 ${tiles.size}개 · 게이트 ${gate ? (gate.pass ? '통과' : '미달') : '측정 지점 없음'}`, gate ?? '');
}
