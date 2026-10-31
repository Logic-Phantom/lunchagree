// 후보 추가: ① 기준역 주변 공공데이터 음식점에서 고르기(샤드가 있을 때) ② 직접 입력(이름·종류·가격은 선택, '직접 입력' 표시).
import { useMemo, useState } from 'react';
import { Button, Chip, Sheet } from '../../components/ui';
import type { NearbyResult } from '../../data/places-api';
import type { NewCandidate } from '../../data/room-repo';
import { estimateWalkMinutes, FOOD_TAGS, haversineMeters, tagLabel } from '../../domain';

export function AddCandidateSheet({
  open, onClose, onAdd, nearby, existingPlaceIds,
}: { open: boolean; onClose: () => void; onAdd: (c: NewCandidate) => Promise<void>; nearby: NearbyResult | null; existingPlaceIds: Set<string> }) {
  const [tab, setTab] = useState<'nearby' | 'manual'>(nearby?.status === 'ok' ? 'nearby' : 'manual');
  const [name, setName] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const places = useMemo(() => {
    if (nearby?.status !== 'ok') return [];
    const term = q.trim();
    return nearby.places
      .filter((p) => !existingPlaceIds.has(p.id) && (!term || p.name.includes(term) || p.tags.some((t) => tagLabel(t).includes(term))))
      .map((p) => ({ p, walk: estimateWalkMinutes(haversineMeters(nearby.station, p)) }))
      .sort((a, b) => a.walk - b.walk)
      .slice(0, 40);
  }, [nearby, q, existingPlaceIds]);

  const priceNum = price.trim() ? Number(price.replace(/[^0-9]/g, '')) : null;
  const priceValid = priceNum == null || (priceNum >= 1000 && priceNum <= 100000);

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

  return (
    <Sheet
      open={open}
      title="후보 추가"
      onClose={onClose}
      footer={tab === 'manual' ? <Button onClick={submitManual} disabled={!name.trim() || !priceValid || busy}>추가하기</Button> : undefined}
    >
      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'nearby'} className={tab === 'nearby' ? 'on' : ''} onClick={() => setTab('nearby')}>
          주변에서 고르기
        </button>
        <button type="button" role="tab" aria-selected={tab === 'manual'} className={tab === 'manual' ? 'on' : ''} onClick={() => setTab('manual')}>
          직접 입력
        </button>
      </div>

      {tab === 'nearby' &&
        (nearby?.status === 'ok' ? (
          <>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·종류 검색" aria-label="주변 음식점 검색" />
            <ul className="search-list">
              {places.map(({ p, walk }) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={async () => {
                      await onAdd({ source: 'PUBLIC_DATA', placeId: p.id, name: p.name, address: p.address, lat: p.lat, lng: p.lng, tags: p.tags, priceHint: null });
                      onClose();
                    }}
                  >
                    <strong>{p.name}</strong>
                    <small>
                      {p.tags.map(tagLabel).join('·') || '종류 미확인'}
                      {p.tagSource === 'estimated' ? '(추정)' : ''} · 약 {walk}분(추정)
                    </small>
                  </button>
                </li>
              ))}
            </ul>
            <p className="caption">출처: 행정안전부 일반음식점 인허가 정보(기준일 {nearby.baseDate}). 실제 상호·영업 여부는 다를 수 있어요.</p>
          </>
        ) : (
          <p className="empty">
            {nearby?.status === 'error'
              ? '주변 음식점을 불러오지 못했어요. 직접 입력으로 추가해 주세요.'
              : '아직 이 지역 음식점 데이터가 준비되지 않았어요. 직접 입력으로 추가해 주세요.'}
          </p>
        ))}

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
  );
}
