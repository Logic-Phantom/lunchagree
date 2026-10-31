// 데이터 빌드: raw/ 원본 CSV → 영업 필터 → 좌표 변환 → 태그 → 역별 1km 샤드 → out/v1/ (GitHub Pages 배포 대상)
// 사용: npm run data:build
//   필요 파일
//   - data-build/raw/15045016_일반음식점_<기준일YYYYMMDD>.csv   (data.go.kr에서 내려받은 원본, 수정 금지)
//   - data-build/fixtures/station-coords.json                  (역 ID·좌표 — Phase 0에서 출처 확정 후 생성)
// 실패 시 exit 1 → data-build.yml은 이전 Pages 산출물을 그대로 둔다.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseCsv } from './csv.ts';
import { shardByStation, type StationCoord } from './shard-by-station.ts';
import { toPlaces } from './transform.ts';
import { checkGate, missingColumns } from './validate.ts';

const ROOT = resolve(import.meta.dirname, '..');
const RAW = join(ROOT, 'raw');
const OUT = join(ROOT, 'out', 'v1');
// Phase 0 측정 역(프롬프트 §9 제안 10곳). 사용자 지정 시 교체.
export const FOCUS_STATIONS = ['강남', '역삼', '선릉', '삼성', '여의도', '광화문', '시청', '을지로입구', '판교', '구로디지털단지'];

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const rawFile = readdirSync(RAW).filter((f) => /^15045016_.*_(\d{8})\.csv$/.test(f)).sort().at(-1);
if (!rawFile) fail('raw/15045016_*_YYYYMMDD.csv 원본이 없어요. data-build/raw/README.md 참고.');
const baseDate = rawFile.match(/_(\d{4})(\d{2})(\d{2})\.csv$/)!.slice(1).join('-');

let stations: StationCoord[];
try {
  stations = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'station-coords.json'), 'utf8')).stations;
} catch {
  fail('fixtures/station-coords.json(역 좌표)이 없어요. Phase 0에서 좌표 출처를 정한 뒤 만들어요.');
}

const rows = parseCsv(readFileSync(join(RAW, rawFile), 'utf8'));
const missing = missingColumns(Object.keys(rows[0] ?? {}));
if (missing.length) fail(`필수 컬럼 없음: ${missing.join(', ')} → src/column-map.ts를 실제 컬럼명으로 고쳐요.`);

const { places, stats } = toPlaces(rows, baseDate);
const shards = shardByStation(stations, places);
const focusIds = FOCUS_STATIONS.map((n) => stations.find((s) => s.name === n)?.id).filter((x): x is string => !!x);
const gate = checkGate(shards, focusIds);

mkdirSync(join(OUT, 'near'), { recursive: true });
writeFileSync(join(OUT, 'stations.json'), JSON.stringify({ baseDate, stations }));
for (const s of stations) {
  writeFileSync(join(OUT, 'near', `${s.id}.json`), JSON.stringify({ station: { lat: s.lat, lng: s.lng }, baseDate, places: shards.get(s.id) ?? [] }));
}
writeFileSync(
  join(ROOT, 'out', 'report.json'),
  JSON.stringify({ rawFile, baseDate, stats, gate, focus: focusIds.map((id) => ({ id, count: shards.get(id)?.length ?? 0 })) }, null, 2),
);
console.log(`✓ ${stats.kept}/${stats.total} 영업 중 · 역 ${stations.length}개 샤드 · 게이트 ${gate.pass ? '통과' : '미달'}`, gate);
