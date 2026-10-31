// 행정안전부_식품_일반음식점 조회서비스(data.go.kr 15154916) 수집. 서비스 키 필요(DATA_GO_KR_KEY, 커밋 금지).
//
//   npm run fetch:api --workspace data-build -- --probe
//       지역 몇 곳의 첫 페이지만 받아 영업상태 코드·이름, 업태 값, 좌표 예시, 지역별 건수를 출력한다(호출 수 ≈ 지역 수).
//   npm run fetch:api --workspace data-build -- --open-code <영업상태코드> [--regions "서울특별시 강남구,서울특별시 중구"]
//       역 좌표 파일의 역사 주소에서 시·군·구 목록을 뽑아, 지역마다 '영업' 상태만 전부 받는다.
//       --focus 를 붙이면 Phase 0 측정 역 10곳이 있는 지역만 받는다.
//       raw/15154916_일반음식점_<YYYYMMDD>/<지역>.ndjson — 지역 단위로 이어받기(이미 있는 파일은 건너뜀).
//
// 개발계정 하루 호출 한도가 있으므로(포털 마이페이지에서 확인) 시작 전에 예상 호출 수를 출력하고, 한도 오류가 나면 멈춘다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { API, COLUMNS, KEEP_FIELDS } from './column-map.ts';
import { regionOf } from './stations.ts';
import { FOCUS_STATIONS } from './validate.ts';

const ROOT = resolve(import.meta.dirname, '..');
const UA = 'Mozilla/5.0 (jeomsimhabui data-build)';
const DELAY_MS = 120;

type Item = Record<string, string>;
interface Page { total: number; items: Item[] }

export class ApiError extends Error {}

/** 응답 본문 → items. 결과가 1건이면 item이 객체로 오는 경우도 처리. */
export function parsePage(body: unknown): Page {
  const res = (body as { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { totalCount?: number; items?: { item?: Item | Item[] } | '' } } }).response;
  if (!res) throw new ApiError(`응답 형식 이상: ${JSON.stringify(body).slice(0, 200)}`);
  const code = res.header?.resultCode;
  if (code && code !== '00' && code !== '0') throw new ApiError(`API 오류 ${code}: ${res.header?.resultMsg}`);
  const raw = res.body?.items && typeof res.body.items === 'object' ? res.body.items.item : undefined;
  const items = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
  return { total: Number(res.body?.totalCount ?? 0), items };
}

export function slim(item: Item): Item {
  return Object.fromEntries(KEEP_FIELDS.map((k) => [k, String(item[k] ?? '').trim()]));
}

async function callPage(key: string, pageNo: number, cond: Record<string, string>): Promise<Page> {
  const qs = new URLSearchParams({ serviceKey: key, pageNo: String(pageNo), numOfRows: String(API.maxRows), returnType: 'json', ...cond });
  const res = await fetch(`${API.endpoint}?${qs}`, { headers: { 'User-Agent': UA } });
  const text = await res.text();
  if (!res.ok) throw new ApiError(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  try {
    return parsePage(JSON.parse(text));
  } catch (e) {
    if (e instanceof ApiError) throw e;
    // 키 오류 등은 XML(OpenAPI_ServiceResponse)로 온다
    throw new ApiError(`JSON 아님: ${text.slice(0, 300)}`);
  }
}

function stationRegions(focusOnly: boolean): string[] {
  if (focusOnly) {
    // Phase 0 게이트 측정 역 10곳이 있는 지역만(호출 수 절약)
    const { stations } = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'station-coords.json'), 'utf8')) as { stations: { name: string; address: string }[] };
    return [...new Set(stations.filter((s) => FOCUS_STATIONS.includes(s.name)).map((s) => regionOf(s.address)).filter((r): r is string => !!r))];
  }
  const file = join(ROOT, 'fixtures', 'station-regions.json');
  if (!existsSync(file)) throw new Error('fixtures/station-regions.json 없음 — npm run stations 먼저');
  return (JSON.parse(readFileSync(file, 'utf8')) as { regions: string[] }).regions;
}

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) {
    console.error('✗ DATA_GO_KR_KEY가 없어요. data.go.kr에서 15154916 활용신청 후 받은 "일반 인증키(Decoding)"를 환경변수로 넣어 주세요.');
    process.exit(1);
  }
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '');

  if (process.argv.includes('--probe')) {
    const sample = ['서울특별시 강남구', '서울특별시 중구', '서울특별시 영등포구', '경기도 성남시 분당구'];
    const codes = new Map<string, number>();
    const types = new Map<string, number>();
    const report: Record<string, unknown> = { at: new Date().toISOString(), regions: {} as Record<string, number> };
    for (const region of sample) {
      const page = await callPage(key, 1, { 'cond[ROAD_NM_ADDR::LIKE]': region });
      (report.regions as Record<string, number>)[region] = page.total;
      for (const it of page.items) {
        const c = `${it[COLUMNS.statusCode]} ${it[COLUMNS.status]} / ${it[COLUMNS.detailStatus]}`;
        codes.set(c, (codes.get(c) ?? 0) + 1);
        const t = `${it[COLUMNS.businessType]} | ${it[COLUMNS.sanitationType]}`;
        types.set(t, (types.get(t) ?? 0) + 1);
      }
      report.example ??= slim(page.items[0] ?? {});
      await new Promise((ok) => setTimeout(ok, DELAY_MS));
    }
    report.statusValues = [...codes].sort((a, b) => b[1] - a[1]);
    report.businessTypes = [...types].sort((a, b) => b[1] - a[1]);
    mkdirSync(join(ROOT, 'out'), { recursive: true });
    writeFileSync(join(ROOT, 'out', 'probe.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    console.log('→ 영업 코드를 확인해 column-map.ts OPEN_STATUS_VALUES를 고치고 --open-code <코드>로 전체 수집하세요.');
  } else {
    const openCode = argValue('--open-code');
    if (!openCode) {
      console.error('✗ --open-code <영업상태코드>가 필요해요. 먼저 --probe로 실제 코드를 확인하세요(추측 금지).');
      process.exit(1);
    }
    const regions = argValue('--regions')?.split(',').map((s) => s.trim()) ?? stationRegions(process.argv.includes('--focus'));
    console.log(`지역 ${regions.length}곳: ${regions.join(', ')}`);
    const dir = join(ROOT, 'raw', `15154916_일반음식점_${today}`);
    mkdirSync(dir, { recursive: true });
    let calls = 0;
    for (const region of regions) {
      const file = join(dir, `${region.replace(/\s+/g, '_')}.ndjson`);
      if (existsSync(file)) continue; // 이어받기
      const cond = { 'cond[ROAD_NM_ADDR::LIKE]': region, 'cond[SALS_STTS_CD::EQ]': openCode };
      const first = await callPage(key, 1, cond);
      calls += 1;
      const pages = Math.ceil(first.total / API.maxRows);
      const items = first.items.map(slim);
      for (let p = 2; p <= pages; p += 1) {
        await new Promise((ok) => setTimeout(ok, DELAY_MS));
        items.push(...(await callPage(key, p, cond)).items.map(slim));
        calls += 1;
      }
      // 주소 LIKE는 '부분 일치'라 다른 지역('서울특별시 중구' ⊂ '서울특별시 중구청로'?)이 섞일 수 있어 앞부분 일치만 남긴다
      const kept = items.filter((it) => it[COLUMNS.roadAddress].startsWith(region));
      writeFileSync(file, kept.map((it) => JSON.stringify(it)).join('\n') + '\n');
      console.log(`✓ ${region}: ${kept.length}/${first.total}건 (${pages}쪽, 누적 호출 ${calls})`);
    }
    writeFileSync(join(dir, '_meta.json'), JSON.stringify({ source: 'data.go.kr 15154916', fetchedAt: new Date().toISOString(), openCode, regions }, null, 2));
  }
}
