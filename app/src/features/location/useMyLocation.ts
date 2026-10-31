// 내 위치 + 주변 음식점. 위치는 사용자가 버튼을 눌렀을 때만 묻고(진입 즉시 권한 요청 금지), 앱 메모리에만 둔다(저장·전송 안 함, D-037).
import { useCallback, useEffect, useState } from 'react';
import { fetchNearbyPlaces, type NearbyResult } from '../../data/places-api';
import { getMyLocation, type MyLocation } from '../../platform/toss';

// 화면을 오가도 다시 묻지 않게 세션(메모리) 동안만 기억한다. 앱을 닫으면 사라진다.
let sessionLocation: MyLocation | null = null;
const listeners = new Set<(l: MyLocation | null) => void>();

export type LocationState = 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable';

export function useMyLocation() {
  const [location, setLocation] = useState<MyLocation | null>(sessionLocation);
  const [state, setState] = useState<LocationState>(sessionLocation ? 'ready' : 'idle');

  useEffect(() => {
    const on = (l: MyLocation | null) => {
      setLocation(l);
      if (l) setState('ready');
    };
    listeners.add(on);
    return () => {
      listeners.delete(on);
    };
  }, []);

  const locate = useCallback(async () => {
    setState('locating');
    const r = await getMyLocation();
    if (r.ok) {
      sessionLocation = r.location;
      for (const l of listeners) l(r.location);
      setState('ready');
    } else setState(r.reason);
  }, []);

  return { location, state, locate };
}

export function useNearbyPlaces(location: MyLocation | null) {
  const [nearby, setNearby] = useState<NearbyResult | null>(null);
  useEffect(() => {
    if (!location) {
      setNearby(null);
      return;
    }
    let alive = true;
    setNearby(null);
    fetchNearbyPlaces(location).then((r) => alive && setNearby(r));
    return () => {
      alive = false;
    };
  }, [location]);
  return nearby;
}

export const LOCATION_NOTICE = '주변 음식점을 찾으려고 현재 위치를 한 번 확인해요. 위치는 이 기기에서 거리 계산에만 쓰고 저장하거나 서버로 보내지 않아요.';

export function locationErrorText(state: LocationState): string | null {
  if (state === 'denied') return '위치 권한이 없어 주변 음식점을 찾을 수 없어요. 후보를 직접 추가하거나, 설정에서 위치 권한을 켠 뒤 다시 눌러 주세요.';
  if (state === 'unavailable') return '지금은 위치를 확인할 수 없어요. 잠시 후 다시 시도하거나 후보를 직접 추가해 주세요.';
  return null;
}
