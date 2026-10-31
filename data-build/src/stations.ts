// 역 좌표: 사잇 역 ID·이름(fixtures/stations-saeit.json) + 국가철도공단 도시광역철도 역사정보(raw/15093755_*.xlsx, 역위도·역경도 WGS84)
// → fixtures/station-coords.json. 같은 이름의 행(노선별)은 평균, 행끼리 1km 넘게 떨어지면 동명이역으로 보고 제외(보고서에 남김).
// 사용: npm run stations --workspace data-build
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { haversine } from './shard-by-station.ts';
import { readXlsxRows, rowsToRecords } from './xlsx.ts';

const ROOT = resolve(import.meta.dirname, '..');
export const AMBIGUOUS_SPREAD_M = 1000;
// 사잇 노선 범위(수도권 + 경춘선 강원 구간 + 1호선 충남 구간)만: 다른 지역 동명이역(부산 '서면' 등)과 섞이지 않게
const METRO = /^(서울|경기|인천|강원|충청남도|충남)/;

/** 사잇 D-027과 같은 정규화: 공백 제거, 괄호 부역명 제거, 끝 '역' 제거('서울역' 예외). */
export function normalizeStationName(name: string): string {
  const n = name.replace(/\s+/g, '').replace(/\(.*?\)/g, '').replace(/[.·]/g, '');
  return n === '서울역' ? '서울' : n.replace(/역$/, '');
}

export interface StationRow { name: string; lat: number; lng: number; address: string; line: string }

export function parseStationRows(records: Record<string, string>[]): StationRow[] {
  return records
    .map((r) => ({ name: normalizeStationName(r['역사명']), lat: Number(r['역위도']), lng: Number(r['역경도']), address: r['역사도로명주소'] ?? '', line: r['노선명'] ?? '' }))
    .filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lng) && r.lat > 33 && r.lat < 39 && r.lng > 124 && r.lng < 132);
}

export interface Matched { id: string; name: string; lat: number; lng: number; rows: number; address: string }

// 역사 주소의 시·도 표기를 현행 공식 명칭으로(원본에 '서울시', '충남', '강원도' 등이 섞여 있음)
const SIDO: Record<string, string> = {
  서울: '서울특별시', 서울시: '서울특별시', 서울특별시: '서울특별시',
  인천: '인천광역시', 인천시: '인천광역시', 인천광역시: '인천광역시',
  경기: '경기도', 경기도: '경기도',
  강원: '강원특별자치도', 강원도: '강원특별자치도', 강원특별자치도: '강원특별자치도',
  충남: '충청남도', 충청남도: '충청남도',
};
// 원본 오타·옛 이름
const SIGUNGU_FIX: Record<string, string> = { 춘춘시: '춘천시', 남양주: '남양주시', 남구: '미추홀구' };

/**
 * 역사 도로명주소 → 음식점 API 지역 조건 '시도 시군구'(예: '서울특별시 강남구', '경기도 성남시').
 * 시 아래 일반구(분당구 등)는 개편이 잦아(부천 2024 구 부활) 시 단위로 묶는다. 시·도 명칭은 Phase 0 --probe로 실제 표기 확인.
 */
export function regionOf(address: string): string | null {
  const t = address.trim().split(/\s+/);
  const sido = SIDO[t[0]];
  if (!sido || t.length < 2) return null;
  return `${sido} ${SIGUNGU_FIX[t[1]] ?? t[1]}`;
}

export function matchStations(
  saeit: { id: string; name: string }[],
  rows: StationRow[],
): { matched: Matched[]; missing: string[]; ambiguous: { name: string; spreadM: number; lines: string[] }[] } {
  const byName = new Map<string, StationRow[]>();
  for (const r of rows) {
    if (r.address && !METRO.test(r.address)) continue;
    byName.set(r.name, [...(byName.get(r.name) ?? []), r]);
  }
  const matched: Matched[] = [];
  const missing: string[] = [];
  const ambiguous: { name: string; spreadM: number; lines: string[] }[] = [];
  for (const s of saeit) {
    // 사잇 이름의 괄호 노선 힌트(예: '양평(경의중앙선)')로 동명이역을 가른다. 힌트 없는 쪽은 다른 이름이 힌트로 가져간 노선을 뺀다.
    const hint = /\((.+?)선?\)/.exec(s.name)?.[1];
    const taken = saeit.filter((o) => o !== s && normalizeStationName(o.name) === normalizeStationName(s.name)).map((o) => /\((.+?)선?\)/.exec(o.name)?.[1]).filter((x): x is string => !!x);
    const list = byName
      .get(normalizeStationName(s.name.replace(/[.·]/g, '')))
      ?.filter((r) => (hint ? r.line.includes(hint) : !taken.some((t) => r.line.includes(t))));
    if (!list?.length) {
      missing.push(s.name);
      continue;
    }
    let spread = 0;
    for (const a of list) for (const b of list) spread = Math.max(spread, haversine(a, b));
    if (spread > AMBIGUOUS_SPREAD_M) {
      ambiguous.push({ name: s.name, spreadM: Math.round(spread), lines: list.map((r) => r.line) });
      continue;
    }
    const lat = list.reduce((t, r) => t + r.lat, 0) / list.length;
    const lng = list.reduce((t, r) => t + r.lng, 0) / list.length;
    matched.push({ id: s.id, name: s.name, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, rows: list.length, address: list.find((r) => r.address)?.address ?? '' });
  }
  return { matched, missing, ambiguous };
}

if (import.meta.main) {
  const file = readdirSync(join(ROOT, 'raw')).filter((f) => /^15093755_.*_(\d{8})\.xlsx$/.test(f)).sort().at(-1);
  if (!file) throw new Error('raw/15093755_*_YYYYMMDD.xlsx 없음 — data-build/raw/README.md 참고');
  const baseDate = file.match(/_(\d{4})(\d{2})(\d{2})\.xlsx$/)!.slice(1).join('-');
  const rows = parseStationRows(rowsToRecords(readXlsxRows(readFileSync(join(ROOT, 'raw', file))), ['역사명', '역위도', '역경도']));
  const saeit = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'stations-saeit.json'), 'utf8')) as { stations: { id: string; name: string }[] };
  const { matched, missing, ambiguous } = matchStations(saeit.stations, rows);
  writeFileSync(
    join(ROOT, 'fixtures', 'station-coords.json'),
    `${JSON.stringify({
      note: 'npm run stations 산출물 — 직접 고치지 않는다. 좌표는 노선별 역사 좌표의 평균.',
      source: '국가철도공단_도시광역철도_역사정보(data.go.kr 15093755 / 철도데이터포털 id=32), 이용허락범위 제한 없음',
      baseDate,
      stations: matched,
      missing,
      ambiguous,
    }, null, 1)}\n`,
  );
  const regions = [...new Set(matched.map((m) => regionOf(m.address)).filter((r): r is string => !!r))].sort();
  writeFileSync(join(ROOT, 'fixtures', 'station-regions.json'), `${JSON.stringify({ note: 'npm run stations 산출물 — 음식점 API 수집 지역', regions }, null, 1)}
`);
  console.log(`  수집 지역(시군구) ${regions.length}곳`);
  console.log(`✓ 원본 ${rows.length}행 · 사잇 역 ${saeit.stations.length}개 중 ${matched.length}개 좌표 확보 · 없음 ${missing.length} · 동명이역 제외 ${ambiguous.length}`);
  if (missing.length) console.log('  없음:', missing.join(', '));
  if (ambiguous.length) console.log('  동명이역:', ambiguous.map((a) => `${a.name}(${a.spreadM}m)`).join(', '));
}
