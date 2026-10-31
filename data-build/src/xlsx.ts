// 아주 작은 XLSX 리더(의존성 없음): zip 중앙 디렉터리 → sharedStrings + 첫 시트 → 행 배열.
// 공공데이터 표준 파일(문자열·숫자 셀, 한 시트)만 대상. 수식·날짜 서식·병합 셀은 처리하지 않는다.
import { inflateRawSync } from 'node:zlib';

function unzip(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) throw new Error('zip: 끝 레코드 없음');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i += 1) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    files.set(name, method === 8 ? inflateRawSync(data) : Buffer.from(data));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const unescapeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** 첫 시트를 문자열 2차원 배열로. */
export function readXlsxRows(buf: Buffer): string[][] {
  const files = unzip(buf);
  const shared: string[] = [];
  const ss = files.get('xl/sharedStrings.xml')?.toString('utf8') ?? '';
  for (const si of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    shared.push(unescapeXml([...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')));
  }
  const sheetName = [...files.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  const sheet = files.get(sheetName)?.toString('utf8') ?? '';
  const rows: string[][] = [];
  for (const r of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const c of r[1].matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, ref, attrs, inner = ''] = c;
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      const t = /t="(\w+)"/.exec(attrs)?.[1];
      let value = '';
      if (t === 's' && v != null) value = shared[Number(v)] ?? '';
      else if (t === 'inlineStr') value = unescapeXml([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(''));
      else if (v != null) value = unescapeXml(v);
      row[colIndex(ref)] = value.trim();
    }
    rows.push(Array.from(row, (x) => x ?? ''));
  }
  return rows;
}

/** 헤더 행을 찾아(필수 열 이름이 모두 있는 첫 행) 객체 배열로. */
export function rowsToRecords(rows: string[][], mustHave: string[]): Record<string, string>[] {
  const h = rows.findIndex((r) => mustHave.every((m) => r.includes(m)));
  if (h < 0) throw new Error(`헤더 행 없음: ${mustHave.join(', ')}`);
  const header = rows[h];
  return rows.slice(h + 1).filter((r) => r.some((x) => x)).map((r) => Object.fromEntries(header.map((k, i) => [k, r[i] ?? ''])));
}
