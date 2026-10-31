// 토스 앱 안(WebView)인지 판별하고 SDK 호출을 감싼다(사잇 platform/toss.ts 이식).
// SDK는 토스 밖에서 호출하면 throw하므로(3.9.0 dist 확인: window.ReactNativeWebView == null 이면 오류)
// 같은 조건으로 판별해 브라우저 대체 동작을 쓴다.
import { roomSchemePath } from '@jeomsimhabui/room-core';

export const APP_NAME = 'jeomsimhabui'; // apps-in-toss.config.ts appName과 같게

declare global {
  interface Window { ReactNativeWebView?: unknown }
}

export function isInToss(): boolean {
  return typeof window !== 'undefined' && window.ReactNativeWebView != null;
}

async function sdk() {
  return import('@apps-in-toss/web-framework');
}

/** 앱에 처음 들어온 스킴 URL(intoss://jeomsimhabui/room?t=…). 토스 밖이면 null. */
export async function initialSchemeUrl(): Promise<string | null> {
  if (!isInToss()) return null;
  try {
    return (await sdk()).Environment.initialURL || null;
  } catch {
    return null;
  }
}

export interface MyLocation {
  lat: number;
  lng: number;
  accuracyM: number;
}
export type LocationResult = { ok: true; location: MyLocation } | { ok: false; reason: 'denied' | 'unavailable' };

/**
 * 현재 위치를 한 번 조회한다. 위치는 이 기기 메모리에서만 쓰고 저장·전송하지 않는다(D-037).
 * 토스: Device.getLocation({ accuracy: Balanced }) — 3.9.0 타입: 권한 없으면 GetCurrentLocationPermissionError(PermissionError 하위).
 * 브라우저: navigator.geolocation(8초 제한).
 */
export async function getMyLocation(): Promise<LocationResult> {
  if (isInToss()) {
    try {
      const { Device, Accuracy, PermissionError } = await sdk();
      try {
        const loc = await Device.getLocation({ accuracy: Accuracy.Balanced });
        return { ok: true, location: { lat: loc.coords.latitude, lng: loc.coords.longitude, accuracyM: loc.coords.accuracy } };
      } catch (e) {
        return { ok: false, reason: e instanceof PermissionError ? 'denied' : 'unavailable' };
      }
    } catch {
      return { ok: false, reason: 'unavailable' };
    }
  }
  if (!navigator.geolocation) return { ok: false, reason: 'unavailable' };
  return new Promise((done) => {
    navigator.geolocation.getCurrentPosition(
      (p) => done({ ok: true, location: { lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy } }),
      (err) => done({ ok: false, reason: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

/** 외부 링크(카카오맵·네이버지도 장소 검색)를 기본 브라우저/앱으로 연다. 토스: Device.openURL. ⚠ 앱인토스 외부 링크 허용 범위는 검토 때 확인(D-039). */
export async function openExternal(url: string): Promise<void> {
  if (isInToss()) {
    const { Device } = await sdk();
    await Device.openURL(url);
    return;
  }
  window.open(url, '_blank', 'noopener');
}

const DEVICE_KEY = 'device-anon-key';

/**
 * 사용자 익명 키. 토스: User.getAnonymousKey()의 hash(3.9.0 타입: { type: 'HASH', hash }, 미지원 버전은 throw).
 * 브라우저·미지원: 기기 로컬 랜덤 값. 서버에는 방마다 다시 해시해서만 보낸다(room-core anonHashForRoom).
 */
export async function anonymousKey(): Promise<string> {
  if (isInToss()) {
    try {
      const { User } = await sdk();
      if (User.getAnonymousKey.isSupported()) {
        const res = await User.getAnonymousKey();
        if (res?.type === 'HASH' && res.hash) return res.hash;
      }
    } catch {
      // 미지원 앱 버전 → 기기 값으로 대체
    }
  }
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (saved) return saved;
    const fresh = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

/** 방 참여 링크. 토스: Share.createLink(intoss://), 브라우저: 현재 주소 기준 해시 링크. */
export async function createRoomLink(token: string, ogImageUrl?: string): Promise<string> {
  if (isInToss()) {
    const { Share } = await sdk();
    return Share.createLink({ path: roomSchemePath(APP_NAME, token), ogImageUrl });
  }
  return `${location.origin}${location.pathname}#/join?t=${token}`;
}

export async function shareMessage(message: string): Promise<'shared' | 'copied'> {
  if (isInToss()) {
    const { Share } = await sdk();
    await Share.sendMessage({ message });
    return 'shared';
  }
  if (navigator.share) {
    try {
      await navigator.share({ text: message });
      return 'shared';
    } catch {
      // 사용자가 취소했거나 미지원 → 복사로 대체
    }
  }
  await copyText(message);
  return 'copied';
}

export async function copyText(text: string): Promise<void> {
  if (isInToss()) {
    const { Clipboard } = await sdk();
    await Clipboard.setText(text);
    return;
  }
  await navigator.clipboard.writeText(text);
}
