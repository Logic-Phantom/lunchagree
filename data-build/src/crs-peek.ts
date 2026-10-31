// 수집 중(partial 포함)인 원본으로 좌표계를 미리 판정해 본다(verify-crs.ts와 같은 계산). 개발용.
// 사용: node data-build/src/crs-peek.ts
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compareCrs } from './verify-crs.ts';

const ROOT = resolve(import.meta.dirname, '..');
const dir = readdirSync(join(ROOT, 'raw')).filter((f) => /^15154916_.*_\d{8}$/.test(f)).sort().at(-1);
if (!dir) throw new Error('수집본 없음');
const rows = readdirSync(join(ROOT, 'raw', dir))
  .filter((f) => f.endsWith('.ndjson'))
  .flatMap((f) => readFileSync(join(ROOT, 'raw', dir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, string>));
const points = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'reference-points.json'), 'utf8')).points;
console.log(`rows ${rows.length}`, compareCrs(rows, points));
