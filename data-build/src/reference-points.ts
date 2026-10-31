// 개발용 기준점(앱 기능에는 쓰지 않음): 국가철도공단 도시광역철도 역사정보의 공식 좌표(WGS84)·도로명주소.
// 쓰임 두 가지 — ① verify-crs.ts: 역 안 매장 주소 ↔ 역 좌표로 원본 좌표계 판정 ② validate.ts: Phase 0 측정 지점(업무지구 10곳) 좌표.
// 사용: npm run refpoints --workspace data-build   (원본: raw/15093755_*_YYYYMMDD.xlsx, data-build/raw/README.md)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { haversineMeters } from '../../app/src/domain/distance.ts';
import { readXlsxRows, rowsToRecords } from './xlsx.ts';

const ROOT = resolve(import.meta.dirname, '..');

export interface RefPoint { name: string; address: string; lat: number; lng: number }

/** 같은 이름·1km 안의 행(같은 역의 노선별 행)은 평균으로 합친다. 이름이 같아도 멀면 별도 지점. */
export function mergeRows(records: Record<string, string>[]): RefPoint[] {
  const out: (RefPoint & { n: number })[] = [];
  for (const r of records) {
    // 괄호 부역명('삼성(무역센터)', '광화문(세종문화회관)')은 뗀다
    const name = (r['역사명'] ?? '').replace(/\s+/g, '').replace(/\(.*?\)/g, '').replace(/역$/, '');
    const lat = Number(r['역위도']);
    const lng = Number(r['역경도']);
    if (!name || !(lat > 33 && lat < 39 && lng > 124 && lng < 132)) continue;
    const same = out.find((p) => p.name === name && haversineMeters(p, { lat, lng }) < 1000);
    if (same) {
      same.lat = (same.lat * same.n + lat) / (same.n + 1);
      same.lng = (same.lng * same.n + lng) / (same.n + 1);
      same.n += 1;
      if (!same.address) same.address = r['역사도로명주소'] ?? '';
    } else out.push({ name, address: r['역사도로명주소'] ?? '', lat, lng, n: 1 });
  }
  return out.map(({ name, address, lat, lng }) => ({ name, address, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }));
}

if (import.meta.main) {
  const file = readdirSync(join(ROOT, 'raw')).filter((f) => /^15093755_.*_(\d{8})\.xlsx$/.test(f)).sort().at(-1);
  if (!file) throw new Error('raw/15093755_*_YYYYMMDD.xlsx 없음 — data-build/raw/README.md 참고');
  const baseDate = file.match(/_(\d{4})(\d{2})(\d{2})\.xlsx$/)!.slice(1).join('-');
  const records = rowsToRecords(readXlsxRows(readFileSync(join(ROOT, 'raw', file))), ['역사명', '역위도', '역경도']);
  const points = mergeRows(records);
  writeFileSync(
    join(ROOT, 'fixtures', 'reference-points.json'),
    `${JSON.stringify({
      note: 'npm run refpoints 산출물 — 개발용 기준점(좌표계 판정·Phase 0 측정 지점). 앱 기능에는 쓰지 않는다.',
      source: '국가철도공단_도시광역철도_역사정보(data.go.kr 15093755 / 철도데이터포털 id=32), 이용허락범위 제한 없음',
      baseDate,
      points,
    })}\n`,
  );
  console.log(`✓ 원본 ${records.length}행 → 기준점 ${points.length}곳`);
}
