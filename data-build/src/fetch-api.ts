// 행정안전부_식품_일반음식점 조회서비스(data.go.kr 15154916) 수집. 서비스 키 필요(DATA_GO_KR_KEY, 커밋 금지).
//
//   npm run fetch:api --workspace data-build -- --probe
//       시·도 몇 곳의 첫 페이지만 받아 영업상태 코드·이름, 업태 값, 주소 표기, 지역별 건수를 출력한다(호출 수 ≈ 지역 수).
//   npm run fetch:api --workspace data-build -- --open-code <영업상태코드> [--focus | --regions "서울특별시,경기도"]
//       '내 주변 음식점'은 어디서나 찾을 수 있어야 하므로 기본은 전국 17개 시·도 × '영업' 상태 전부.
//       --focus 는 Phase 0 측정 지점이 있는 서울특별시·경기도만(호출 수 절약).
//       raw/15154916_일반음식점_<YYYYMMDD>/<시도>.ndjson — 쪽 단위 이어받기(<시도>.progress.json), 한도 오류가 나면 멈추고 다음 실행에서 이어 받는다.
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { API, COLUMNS, KEEP_FIELDS } from './column-map.ts';

const ROOT = resolve(import.meta.dirname, '..');
const UA = 'Mozilla/5.0 (jeomsimhabui data-build)';
const DELAY_MS = 120;

/** 현행 시·도 공식 명칭(도로명주소 첫 단어). ⚠ 원본 표기는 --probe로 확인(특히 강원·전북 특별자치도 개칭). */
export const SIDO = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
  '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도',
];
export const FOCUS_SIDO = ['서울특별시', '경기도'];

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

/** 필요한 필드만 남긴다(전화번호·종사자 수 등 버림). */
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

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

async function probe(key: string): Promise<void> {
  const codes = new Map<string, number>();
  const types = new Map<string, number>();
  const sidoSeen = new Map<string, number>();
  const report: Record<string, unknown> = { at: new Date().toISOString(), totals: {} as Record<string, number> };
  for (const region of ['서울특별시', '경기도', '강원', '전북']) {
    const page = await callPage(key, 1, { 'cond[ROAD_NM_ADDR::LIKE]': region });
    (report.totals as Record<string, number>)[region] = page.total;
    for (const it of page.items) {
      const c = `${it[COLUMNS.statusCode]} ${it[COLUMNS.status]} / ${it[COLUMNS.detailStatus]}`;
      codes.set(c, (codes.get(c) ?? 0) + 1);
      const t = `${it[COLUMNS.businessType]} | ${it[COLUMNS.sanitationType]}`;
      types.set(t, (types.get(t) ?? 0) + 1);
      const s = (it[COLUMNS.roadAddress] ?? '').split(/\s+/)[0];
      sidoSeen.set(s, (sidoSeen.get(s) ?? 0) + 1);
    }
    report.example ??= slim(page.items[0] ?? {});
    await sleep(DELAY_MS);
  }
  report.statusValues = [...codes].sort((a, b) => b[1] - a[1]);
  report.businessTypes = [...types].sort((a, b) => b[1] - a[1]);
  report.sidoNames = [...sidoSeen];
  mkdirSync(join(ROOT, 'out'), { recursive: true });
  writeFileSync(join(ROOT, 'out', 'probe.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log('→ 영업 코드를 확인해 column-map.ts OPEN_STATUS_VALUES를 고치고 --open-code <코드>로 수집하세요. 시·도 표기가 SIDO와 다르면 SIDO를 고치세요.');
}

async function fetchRegion(key: string, dir: string, region: string, openCode: string): Promise<number> {
  const base = join(dir, region);
  if (existsSync(`${base}.ndjson`)) return 0; // 완료된 지역
  const progressFile = `${base}.progress.json`;
  const progress = existsSync(progressFile) ? (JSON.parse(readFileSync(progressFile, 'utf8')) as { nextPage: number; pages: number }) : { nextPage: 1, pages: 0 };
  const cond = { 'cond[ROAD_NM_ADDR::LIKE]': region, 'cond[SALS_STTS_CD::EQ]': openCode };
  let calls = 0;
  do {
    const page = await callPage(key, progress.nextPage, cond);
    calls += 1;
    progress.pages = Math.ceil(page.total / API.maxRows);
    // LIKE는 부분 일치라 앞부분 일치만 남긴다
    const kept = page.items.map(slim).filter((it) => it[COLUMNS.roadAddress].startsWith(region));
    if (kept.length) appendFileSync(`${base}.partial.ndjson`, kept.map((it) => JSON.stringify(it)).join('\n') + '\n');
    progress.nextPage += 1;
    writeFileSync(progressFile, JSON.stringify(progress));
    if (progress.nextPage % 50 === 0) console.log(`  ${region} ${progress.nextPage - 1}/${progress.pages}쪽`);
    await sleep(DELAY_MS);
  } while (progress.nextPage <= progress.pages);
  if (existsSync(`${base}.partial.ndjson`)) renameSync(`${base}.partial.ndjson`, `${base}.ndjson`);
  else writeFileSync(`${base}.ndjson`, '');
  console.log(`✓ ${region}: ${progress.pages}쪽 (이번 실행 호출 ${calls})`);
  return calls;
}

if (import.meta.main) {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) {
    console.error('✗ DATA_GO_KR_KEY가 없어요. data.go.kr에서 15154916 활용신청 후 받은 "일반 인증키(Decoding)"를 data-build/.env 또는 환경변수로 넣어 주세요.');
    process.exit(1);
  }
  if (process.argv.includes('--probe')) {
    await probe(key);
  } else {
    const openCode = argValue('--open-code');
    if (!openCode) {
      console.error('✗ --open-code <영업상태코드>가 필요해요. 먼저 --probe로 실제 코드를 확인하세요(추측 금지).');
      process.exit(1);
    }
    const regions = argValue('--regions')?.split(',').map((s) => s.trim()) ?? (process.argv.includes('--focus') ? FOCUS_SIDO : SIDO);
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '');
    // 이어받기: 오늘 폴더가 없으면 가장 최근의 미완료 폴더를 계속 쓴다
    const dir = join(ROOT, 'raw', `15154916_일반음식점_${argValue('--date') ?? today}`);
    mkdirSync(dir, { recursive: true });
    console.log(`지역 ${regions.length}곳: ${regions.join(', ')}`);
    let total = 0;
    try {
      for (const region of regions) total += await fetchRegion(key, dir, region, openCode);
    } catch (e) {
      console.error(`✗ ${(e as Error).message}\n  여기까지 저장했어요. 같은 명령에 --date ${dir.slice(-8)} 를 붙여 다시 실행하면 이어 받아요.`);
      process.exit(1);
    }
    writeFileSync(join(dir, '_meta.json'), JSON.stringify({ source: 'data.go.kr 15154916', fetchedAt: new Date().toISOString(), openCode, regions, calls: total }, null, 2));
  }
}
