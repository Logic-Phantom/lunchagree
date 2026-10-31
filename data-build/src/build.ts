// 데이터 빌드: raw/15154916_일반음식점_YYYYMMDD/*.ndjson(API 수집본) → 영업 필터 → 좌표 변환 → 태그 → 역별 1km 샤드 → out/v1/ (GitHub Pages 배포 대상)
// 사용: npm run data:build
//   필요: npm run stations(역 좌표) · npm run fetch:api(음식점 원본)
// 실패 시 exit 1 → data-build.yml은 이전 Pages 산출물을 그대로 둔다.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SOURCE_CRS } from './reproject.ts';
import { shardByStation, type StationCoord } from './shard-by-station.ts';
import { toPlaces } from './transform.ts';
import { checkGate, FOCUS_STATIONS, missingColumns } from './validate.ts';
import { readNdjsonDir } from './verify-crs.ts';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'out', 'v1');

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (import.meta.main) {
  const dir = existsSync(join(ROOT, 'raw')) ? readdirSync(join(ROOT, 'raw')).filter((f) => /^15154916_.*_(\d{8})$/.test(f)).sort().at(-1) : undefined;
  if (!dir) fail('raw/15154916_일반음식점_YYYYMMDD/ 수집본이 없어요. npm run fetch:api (DATA_GO_KR_KEY 필요).');
  const baseDate = dir.match(/_(\d{4})(\d{2})(\d{2})$/)!.slice(1).join('-');

  let stations: StationCoord[];
  try {
    stations = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'station-coords.json'), 'utf8')).stations;
  } catch {
    fail('fixtures/station-coords.json(역 좌표)이 없어요. npm run stations.');
  }

  const rows = readNdjsonDir(join(ROOT, 'raw', dir));
  const missing = missingColumns(Object.keys(rows[0] ?? {}));
  if (missing.length) fail(`필수 필드 없음: ${missing.join(', ')} → src/column-map.ts를 실제 필드명으로 고쳐요.`);

  const { places, stats } = toPlaces(rows, baseDate);
  const shards = shardByStation(stations, places);
  const focusIds = FOCUS_STATIONS.map((n) => stations.find((s) => s.name === n)?.id).filter((x): x is string => !!x);
  const gate = checkGate(shards, focusIds);

  mkdirSync(join(OUT, 'near'), { recursive: true });
  writeFileSync(join(OUT, 'stations.json'), JSON.stringify({ baseDate, stations: stations.map(({ id, name, lat, lng }) => ({ id, name, lat, lng })) }));
  for (const s of stations) {
    writeFileSync(join(OUT, 'near', `${s.id}.json`), JSON.stringify({ station: { lat: s.lat, lng: s.lng }, baseDate, places: shards.get(s.id) ?? [] }));
  }
  writeFileSync(
    join(ROOT, 'out', 'report.json'),
    JSON.stringify({ source: dir, baseDate, crs: SOURCE_CRS, stats, gate, focus: focusIds.map((id) => ({ id, name: stations.find((s) => s.id === id)?.name, count: shards.get(id)?.length ?? 0 })) }, null, 2),
  );
  console.log(`✓ ${stats.kept}/${stats.total} 영업 중 · 역 ${stations.length}개 샤드 · 게이트 ${gate.pass ? '통과' : '미달'}`, gate);
}
