// Phase 0 탐색: 원본 CSV의 컬럼 목록, 영업상태 값 분포, 업태 값 분포, 좌표 결측률을 출력한다(docs/DATA_SOURCES.md에 옮겨 적음).
// 사용: npm run data:report -- <파일 경로(생략 시 raw/의 최신 15045016 파일)>
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { COLUMNS } from './column-map.ts';
import { parseCsv } from './csv.ts';

const RAW = resolve(import.meta.dirname, '..', 'raw');
const file = process.argv[2] ?? join(RAW, readdirSync(RAW).filter((f) => f.startsWith('15045016_')).sort().at(-1) ?? '');
const rows = parseCsv(readFileSync(file, 'utf8'));

function dist(col: string) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r[col] ?? '(없음)', (m.get(r[col] ?? '(없음)') ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]).slice(0, 40);
}

const noCoord = rows.filter((r) => !Number(r[COLUMNS.x]) || !Number(r[COLUMNS.y])).length;
console.log(JSON.stringify({
  file,
  rows: rows.length,
  columns: Object.keys(rows[0] ?? {}),
  statusValues: dist(COLUMNS.status),
  businessTypes: dist(COLUMNS.businessType),
  coordMissingRate: rows.length ? noCoord / rows.length : null,
}, null, 2));
