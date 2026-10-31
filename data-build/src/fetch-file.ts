// 공공데이터포털 '파일데이터' 원본을 data-build/raw/ 에 내려받는다(로그인 불필요한 파일만). 사잇 data-build/src/fetch-raw.ts 이식.
// 포털 상세 페이지의 '다운로드' 버튼과 같은 흐름: 상세 페이지 → selectFileDataDownload.do → check-limit.json → fileDownload.do
// 다운로드 한도에 걸려 보안문자를 요구하면 우회하지 않고 멈춘다 → 브라우저에서 직접 받는다.
// 사용: npm run fetch:file --workspace data-build -- <publicDataPk> [...]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAW = resolve(import.meta.dirname, '..', 'raw');
const BASE = 'https://www.data.go.kr';
const UA = 'Mozilla/5.0 (jeomsimhabui data-build)';

/** Phase 0 파일데이터 수집 대상(docs/DATA_SOURCES.md). */
export const FILE_SOURCES: { pk: string; note: string }[] = [
  { pk: '15093755', note: '국가철도공단_도시광역철도_역사정보 (역 좌표)' },
];

class Session {
  private cookies = new Map<string, string>();
  async req(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('User-Agent', UA);
    if (this.cookies.size) headers.set('Cookie', [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '));
    const res = await fetch(BASE + path, { ...init, headers, redirect: 'follow' });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      this.cookies.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
    }
    return res;
  }
  post(path: string, form: Record<string, string>) {
    return this.req(path, {
      method: 'POST',
      body: new URLSearchParams(form),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
    });
  }
}

export interface Fetched { pk: string; title: string; file: string | null; bytes: number; modified: string | null; license: string | null; error?: string }

export async function fetchFileData(pk: string): Promise<Fetched> {
  const s = new Session();
  const page = await (await s.req(`/data/${pk}/fileData.do`)).text();
  const title = /<title>([^<|]+)/.exec(page)?.[1].trim() ?? pk;
  let modified: string | null = null;
  let license: string | null = null;
  const ld = /<script type="application\/ld\+json">(\{[\s\S]*?\})<\/script>/.exec(page);
  if (ld) {
    try {
      const meta = JSON.parse(ld[1]) as { dateModified?: string; license?: { name?: string } };
      modified = meta.dateModified ?? null;
      license = meta.license?.name ?? null;
    } catch {
      // 메타데이터 없음
    }
  }
  const btn = /fn_fileDataDown\('(\d+)',\s*'([^']+)',\s*'([^']*)',\s*'([^']*)'/.exec(page);
  if (!btn) return { pk, title, file: null, bytes: 0, modified, license, error: '다운로드 버튼 없음(외부 링크·API 전용이거나 페이지 구조 변경)' };
  const [, publicDataPk, detailPk, atchFileIdArg, fileDetailSnArg] = btn;

  const info = JSON.parse(
    await (
      await s.post('/tcs/dss/selectFileDataDownload.do', {
        publicDataDetailPk: detailPk, publicDataPk, atchFileId: atchFileIdArg, fileDetailSn: fileDetailSnArg, publicDataTyCode: 'PR0051',
      })
    ).text(),
  ) as { status: boolean; atchFileId: string; fileDetailSn: string; dataSetFileDetailInfo: { dataNm: string; publicDataSj: string; publicDataTyDetailCode: string } };
  if (!info.status) return { pk, title, file: null, bytes: 0, modified, license, error: '다운로드 정보 응답 실패' };

  const limit = await s.post('/cmm/cmm/check-limit.json', { atchFileId: info.atchFileId, fileDetailSn: String(info.fileDetailSn) });
  if (limit.status === 403 || ((await limit.json()) as { needCaptcha?: boolean }).needCaptcha) {
    return { pk, title, file: null, bytes: 0, modified, license, error: '다운로드 한도 — 보안문자 필요(브라우저에서 직접 받으세요)' };
  }
  const d = info.dataSetFileDetailInfo;
  const name = d.publicDataTyDetailCode === 'DATY05' ? d.publicDataSj : d.dataNm;
  const res = await s.req(`/cmm/cmm/fileDownload.do?atchFileId=${info.atchFileId}&fileDetailSn=${info.fileDetailSn}&dataNm=${encodeURI(name)}`);
  const disp = res.headers.get('content-disposition') ?? '';
  const ext = (/\.([a-zA-Z0-9]+)"?\s*$/.exec(decodeURIComponent(disp))?.[1] ?? 'csv').toLowerCase();
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok || buf.length === 0 || buf.subarray(0, 15).toString('latin1').includes('<!DOCTYPE')) {
    return { pk, title, file: null, bytes: 0, modified, license, error: `파일 응답 이상 (HTTP ${res.status})` };
  }
  const date = (modified ?? '').replace(/-/g, '');
  const file = `${pk}_${title.replace(/[\\/:*?"<>|\s]+/g, '_')}_${date}.${ext}`;
  writeFileSync(join(RAW, file), buf); // 원본 그대로 저장(수정 금지)
  return { pk, title, file, bytes: buf.length, modified, license };
}

if (import.meta.main) {
  if (!existsSync(RAW)) mkdirSync(RAW, { recursive: true });
  const pks = process.argv.slice(2).length ? process.argv.slice(2) : FILE_SOURCES.map((s) => s.pk);
  for (const pk of pks) {
    const r = await fetchFileData(pk);
    console.log(r.file ? `✔ ${pk} ${r.title} → ${r.file} (${(r.bytes / 1024).toFixed(1)} KB, 수정일 ${r.modified}, ${r.license})` : `✖ ${pk} ${r.title}: ${r.error}`);
    await new Promise((ok) => setTimeout(ok, 1500)); // 포털 부하를 줄이려고 간격을 둔다
  }
}
