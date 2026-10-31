// 후보 추가: ① 내 주변(현재 위치 반경 1km 공공데이터 음식점) — 목록/지도 ② 직접 입력(이름·종류·가격은 선택, '직접 입력' 표시).
// 위치는 '내 위치로 찾기'를 누를 때만 묻는다. 거부해도 직접 입력은 그대로 된다(토스 체크리스트).
import { useMemo, useState } from 'react';
import { Button, Chip, Notice, Sheet } from '../../components/ui';
import type { NewCandidate } from '../../data/room-repo';
import { FOOD_TAGS, tagLabel, type NearbyPlace } from '../../domain';
import { NearbyMap } from '../location/NearbyMap';
import { PlaceDetailSheet } from '../location/PlaceDetailSheet';
import { LOCATION_NOTICE, locationErrorText, useMyLocation, useNearbyPlaces } from '../location/useMyLocation';

export function nearbyToCandidate(n: NearbyPlace): NewCandidate {
  // 식당의 공개 좌표만 넘긴다. 내 위치·내 기준 도보 분은 서버로 보내지 않는다(D-041)
  return { source: 'PUBLIC_DATA', placeId: n.place.id, name: n.place.name, address: n.place.address, lat: n.place.lat, lng: n.place.lng, tags: n.place.tags, priceHint: null };
}

export function AddCandidateSheet({
  open, onClose, onAdd, existingPlaceIds,
}: { open: boolean; onClose: () => void; onAdd: (c: NewCandidate) => Promise<void>; existingPlaceIds: Set<string> }) {
  const { location, state, locate } = useMyLocation();
  const nearby = useNearbyPlaces(location);
  const [tab, setTab] = useState<'nearby' | 'manual'>('nearby');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [selected, setSelected] = useState<NearbyPlace | null>(null);
  const [name, setName] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    if (nearby?.status !== 'ok') return [];
    const term = q.trim();
    return nearby.places.filter((n) => !term || n.place.name.includes(term) || n.place.tags.some((t) => tagLabel(t).includes(term)));
  }, [nearby, q]);

  const priceNum = price.trim() ? Number(price.replace(/[^0-9]/g, '')) : null;
  const priceValid = priceNum == null || (priceNum >= 1000 && priceNum <= 100000);

  const addNearby = async (n: NearbyPlace) => {
    setSelected(null);
    await onAdd(nearbyToCandidate(n));
  };

  const submitManual = async () => {
    if (!name.trim() || !priceValid || busy) return;
    setBusy(true);
    await onAdd({ source: 'MANUAL', placeId: null, name: name.trim().slice(0, 40), address: null, lat: null, lng: null, tags: tag ? [tag] : [], priceHint: priceNum });
    setBusy(false);
    setName('');
    setTag(null);
    setPrice('');
    onClose();
  };

  const err = locationErrorText(state);

  return (
    <>
      <Sheet
        open={open && !selected}
        title="후보 추가"
        onClose={onClose}
        footer={tab === 'manual' ? <Button onClick={submitManual} disabled={!name.trim() || !priceValid || busy}>추가하기</Button> : undefined}
      >
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'nearby'} className={tab === 'nearby' ? 'on' : ''} onClick={() => setTab('nearby')}>
            내 주변
          </button>
          <button type="button" role="tab" aria-selected={tab === 'manual'} className={tab === 'manual' ? 'on' : ''} onClick={() => setTab('manual')}>
            직접 입력
          </button>
        </div>

        {tab === 'nearby' && !location && (
          <>
            <p className="caption">{LOCATION_NOTICE}</p>
            <Button icon="pin" onClick={() => void locate()} disabled={state === 'locating'}>
              {state === 'locating' ? '위치 확인 중…' : '내 위치로 주변 음식점 찾기'}
            </Button>
            {err && <Notice tone="warn">{err}</Notice>}
          </>
        )}

        {tab === 'nearby' && location && (
          nearby == null ? (
            <p className="loading">주변 음식점을 불러오는 중…</p>
          ) : nearby.status !== 'ok' ? (
            <p className="empty">
              {nearby.status === 'error' ? '주변 음식점을 불러오지 못했어요. 직접 입력으로 추가해 주세요.' : '아직 음식점 데이터가 준비되지 않았어요. 직접 입력으로 추가해 주세요.'}
            </p>
          ) : (
            <>
              <div className="nearby-head">
                <span className="muted">반경 1km · {nearby.places.length}곳</span>
                <div className="segmented segmented--small" role="tablist" aria-label="보기 방식">
                  <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>목록</button>
                  <button type="button" role="tab" aria-selected={view === 'map'} className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>지도</button>
                </div>
              </div>
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·종류 검색" aria-label="주변 음식점 검색" />
              {view === 'map' ? (
                <NearbyMap
                  center={location}
                  pins={list.map((n) => ({ nearby: n, inRoom: existingPlaceIds.has(n.place.id) }))}
                  onSelect={setSelected}
                />
              ) : (
                <ul className="search-list">
                  {list.slice(0, 60).map((n) => (
                    <li key={n.place.id}>
                      <button type="button" onClick={() => setSelected(n)}>
                        <strong>
                          {n.place.name}
                          {existingPlaceIds.has(n.place.id) ? ' · 후보' : ''}
                        </strong>
                        <small>
                          {n.place.tags.map(tagLabel).join('·') || '종류 미확인'}
                          {n.place.tagSource === 'estimated' && n.place.tags.length ? '(추정)' : ''} · 약 {n.walkMin}분(추정)
                        </small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="caption">출처: 행정안전부 일반음식점 인허가 정보(기준일 {nearby.baseDate}). 실제 상호·영업 여부·영업시간은 가게를 눌러 지도 앱에서 확인해 주세요.</p>
            </>
          )
        )}

        {tab === 'manual' && (
          <>
            <label className="field">
              <span>가게 이름</span>
              <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="예: 회사 앞 국밥집" />
            </label>
            <span className="field__label">종류</span>
            <div className="chips">
              {FOOD_TAGS.map((t) => (
                <Chip key={t.id} selected={tag === t.id} onClick={() => setTag(tag === t.id ? null : t.id)}>
                  {t.label}
                </Chip>
              ))}
            </div>
            <label className="field">
              <span>대표 메뉴 가격(선택)</span>
              <input className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="예: 9000" />
            </label>
            {!priceValid && <p className="caption caption--warn">가격은 1,000~100,000원 사이로 입력해 주세요.</p>}
            <p className="caption">직접 넣은 가격은 "직접 입력"으로 표시돼요. 위치를 모르는 후보는 거리 조건을 확인할 수 없어요.</p>
          </>
        )}
      </Sheet>
      <PlaceDetailSheet nearby={selected} onClose={() => setSelected(null)} onAdd={addNearby} added={selected ? existingPlaceIds.has(selected.place.id) : false} />
    </>
  );
}
