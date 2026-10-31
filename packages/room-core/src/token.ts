// 링크 토큰·짧은 코드. 링크에는 토큰만 넣고(닉네임·조건 금지) DB에는 SHA-256 해시만 저장한다.
// Web Crypto(globalThis.crypto)만 사용 → 브라우저·토스 WebView·Node 24에서 같은 코드로 동작.

const B64URL = /^[A-Za-z0-9_-]+$/;
export const TOKEN_BYTES = 16; // 128bit
export const TOKEN_LENGTH = 22; // base64url(16 bytes) 패딩 제거 길이
// 0/O, 1/I/L 처럼 헷갈리는 글자를 뺀 31자
export const SHORT_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const SHORT_CODE_LENGTH = 6;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function isValidToken(token: unknown): token is string {
  return typeof token === 'string' && token.length === TOKEN_LENGTH && B64URL.test(token);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hashToken(token: string): Promise<string> {
  return sha256Hex(token);
}

/** 토스 익명 키를 방마다 다른 값으로 바꿔 보낸다(방 사이에 같은 사람인지 연결할 수 없게). */
export function anonHashForRoom(anonymousKey: string, roomKey: string): Promise<string> {
  return sha256Hex(`${roomKey}:${anonymousKey}`);
}

export function generateShortCode(): string {
  // 31로 나눈 나머지 편향을 없애려고 248(=31×8) 이상은 버린다
  let out = '';
  while (out.length < SHORT_CODE_LENGTH) {
    const buf = new Uint8Array(SHORT_CODE_LENGTH * 2);
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b >= 248) continue;
      out += SHORT_CODE_ALPHABET[b % SHORT_CODE_ALPHABET.length];
      if (out.length === SHORT_CODE_LENGTH) break;
    }
  }
  return out;
}

export function normalizeShortCode(input: string): string | null {
  const code = input.trim().toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== SHORT_CODE_LENGTH) return null;
  for (const ch of code) if (!SHORT_CODE_ALPHABET.includes(ch)) return null;
  return code;
}
