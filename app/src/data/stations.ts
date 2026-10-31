// 기준역 목록(사잇과 같은 역 ID). 좌표는 data-build 산출물(/v1/stations.json)이 배포된 뒤 places-api가 채운다.
import raw from './stations.v1.json';

export interface Station {
  id: string;
  name: string;
  chosung: string;
}

export const STATIONS: Station[] = (raw.stations as [string, string, string][]).map(([id, name, chosung]) => ({ id, name, chosung }));
export const STATION_SOURCE: string = raw.source;

const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const isChosungOnly = (q: string) => [...q].every((ch) => CHOSUNG.includes(ch));

export function stationById(id: string | null): Station | null {
  return id ? (STATIONS.find((s) => s.id === id) ?? null) : null;
}

/** 이름 앞부분 일치 > 부분 일치 > 초성 일치. 끝의 '역'은 무시. */
export function searchStations(query: string, limit = 30): Station[] {
  const q = query.trim().replace(/역$/, '');
  if (!q) return [];
  if (isChosungOnly(q)) return STATIONS.filter((s) => s.chosung.startsWith(q)).slice(0, limit);
  const starts = STATIONS.filter((s) => s.name.startsWith(q));
  const contains = STATIONS.filter((s) => !s.name.startsWith(q) && s.name.includes(q));
  return [...starts, ...contains].slice(0, limit);
}
