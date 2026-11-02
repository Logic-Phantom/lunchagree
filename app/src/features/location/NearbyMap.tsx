// 내 주변 지도: 내 위치를 가운데 두고 반경 링(250m·500m·1km)과 음식점 핀을 그린다. 의존성 없는 SVG(웹 메르카토르, 줌 16).
// 배경 지도: VITE_VWORLD_KEY가 있으면 브이월드(국토교통부 공간정보 오픈플랫폼) 배경지도 타일을 깐다(D-038, URL 형식·도메인 등록은 키 발급 후 확인).
// 키가 없으면 거리 링만 있는 단순 지도 — 길·건물은 보이지 않는다.
// 도심은 반경 1km에 2,500곳이 넘어 가까운 곳만 그리고(MAP_MAX_PINS), 같은 건물 가게는 한 핀으로 묶어 아래 목록에서 고른다.
// 영업시간·실제 영업 여부는 여기서 알 수 없다 → 핀을 누르면 카카오맵·네이버지도 장소 검색으로 연결(D-039).
import { useMemo, useState } from 'react';
import {
  groupPinsByCoord, MAP_MAX_PINS, MAP_RING_STEPS_M, mapViewRadius, PLACE_RADIUS_M, selectMapPlaces, tagLabel, type LatLng, type NearbyPlace,
} from '../../domain';

const Z = 16;
const TILE = 256;
const WORLD = TILE * 2 ** Z;
const VWORLD_KEY = (import.meta.env.VITE_VWORLD_KEY as string | undefined) ?? '';

function project(p: LatLng): { x: number; y: number } {
  const s = Math.sin((p.lat * Math.PI) / 180);
  return { x: ((p.lng + 180) / 360) * WORLD, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * WORLD };
}

function metersPerPx(lat: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** Z;
}

export interface MapPin {
  nearby: NearbyPlace;
  /** 방 후보로 이미 들어간 곳(강조) / 추천 순위(1~3) */
  inRoom?: boolean;
  rank?: number;
}

export function NearbyMap({
  center, pins, selectedId, onSelect, radiusM = PLACE_RADIUS_M,
}: { center: LatLng; pins: MapPin[]; selectedId?: string | null; onSelect: (n: NearbyPlace) => void; radiusM?: number }) {
  const [stackKey, setStackKey] = useState<string | null>(null);
  const shown = useMemo(() => selectMapPlaces(pins, (p) => !!p.inRoom), [pins]);
  const groups = useMemo(() => groupPinsByCoord(shown), [shown]);
  const viewM = useMemo(() => mapViewRadius(shown.map((p) => p.nearby.distanceM), radiusM), [shown, radiusM]);

  const c = project(center);
  const mpp = metersPerPx(center.lat);
  const half = (viewM / mpp) * 1.08;
  const unit = half / 100; // 화면 크기와 무관하게 일정해 보이도록 핀 크기를 보이는 범위에 비례

  const tiles = useMemo(() => {
    if (!VWORLD_KEY) return [];
    const out: { x: number; y: number }[] = [];
    for (let tx = Math.floor((c.x - half) / TILE); tx <= Math.floor((c.x + half) / TILE); tx += 1)
      for (let ty = Math.floor((c.y - half) / TILE); ty <= Math.floor((c.y + half) / TILE); ty += 1) out.push({ x: tx, y: ty });
    return out;
  }, [c.x, c.y, half]);

  // 그리는 순서: 일반 핀 → 방 후보 → 선택된 핀(위로)
  const drawn = groups.map((members) => ({
    key: members[0].nearby.place.id,
    members,
    inRoom: members.some((m) => m.inRoom),
    rank: members.reduce<number | undefined>((best, m) => (m.rank != null && (best == null || m.rank < best) ? m.rank : best), undefined),
    sel: members.some((m) => m.nearby.place.id === selectedId) || members[0].nearby.place.id === stackKey,
  }));
  const ordered = [...drawn].sort((a, b) => Number(a.inRoom) - Number(b.inRoom) || Number(a.sel) - Number(b.sel));
  const stack = drawn.find((d) => d.key === stackKey && d.members.length > 1);
  const omitted = pins.length - shown.length;

  return (
    <figure className="nearby-map">
      <svg viewBox={`${c.x - half} ${c.y - half} ${half * 2} ${half * 2}`} role="img" aria-label={`내 주변 ${shown.length}곳 지도`}>
        <rect x={c.x - half} y={c.y - half} width={half * 2} height={half * 2} className="nearby-map__bg" />
        {tiles.map((t) => (
          <image
            key={`${t.x}_${t.y}`}
            href={`https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Base/${Z}/${t.y}/${t.x}.png`}
            x={t.x * TILE}
            y={t.y * TILE}
            width={TILE}
            height={TILE}
            opacity={0.85}
          />
        ))}
        {MAP_RING_STEPS_M.filter((m) => m <= viewM).map((m) => (
          <g key={m}>
            <circle cx={c.x} cy={c.y} r={m / mpp} className="nearby-map__ring" strokeWidth={unit * 0.5} strokeDasharray={`${unit * 2} ${unit * 2}`} />
            <text x={c.x} y={c.y - m / mpp - unit} className="nearby-map__ring-label" fontSize={unit * 4}>
              {m >= 1000 ? '1km' : `${m}m`}
            </text>
          </g>
        ))}
        {ordered.map(({ key, members, inRoom, rank, sel }) => {
          const first = members[0].nearby;
          const p = project(first.place);
          const many = members.length > 1;
          const r = (inRoom || many ? 3.2 : 2.4) * unit * (sel ? 1.4 : 1);
          const label = rank ?? (many ? members.length : null);
          return (
            <g
              key={key}
              className={`pin${inRoom ? ' pin--room' : ''}${sel ? ' pin--sel' : ''}`}
              onClick={() => {
                if (many) setStackKey(key);
                else {
                  setStackKey(null);
                  onSelect(first);
                }
              }}
              role="button"
              aria-label={many ? `같은 건물 ${members.length}곳` : `${first.place.name}, 약 ${first.walkMin}분`}
            >
              <circle cx={p.x} cy={p.y} r={r * 3} className="pin__hit" />
              <circle cx={p.x} cy={p.y} r={r} strokeWidth={unit * 0.6} />
              {label != null && (
                <text x={p.x} y={p.y + unit * 1.3} fontSize={unit * 3.6} className="pin__rank">
                  {label}
                </text>
              )}
            </g>
          );
        })}
        <circle cx={c.x} cy={c.y} r={unit * 6} className="nearby-map__me-halo" />
        <circle cx={c.x} cy={c.y} r={unit * 2.6} className="nearby-map__me" strokeWidth={unit * 1} />
      </svg>
      {stack && (
        <ul className="search-list" aria-label="같은 건물의 가게">
          {stack.members.map(({ nearby }) => (
            <li key={nearby.place.id}>
              <button type="button" onClick={() => onSelect(nearby)}>
                <strong>{nearby.place.name}</strong>
                <small>{nearby.place.tags.map(tagLabel).join('·') || '종류 미확인'} · 약 {nearby.walkMin}분(추정)</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <figcaption>
        {omitted > 0 && `가까운 ${MAP_MAX_PINS}곳만 표시 · 반경 1km 전체 ${pins.length.toLocaleString('ko-KR')}곳 · `}
        {VWORLD_KEY ? '배경지도 © 국토교통부 브이월드 · ' : ''}음식점 위치: 행정안전부 인허가 정보 · 거리는 직선 기준 추정
      </figcaption>
    </figure>
  );
}
