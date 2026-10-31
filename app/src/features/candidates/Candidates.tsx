// 온보딩 03 '추천 결과' = 방의 중심 화면. 참가자 입력 현황 · 그룹 조건 · 추천 3개 · 내 주변 지도 · 다른 후보 보기 · 후보 추가 · 투표 시작.
// 후보를 누르면 카카오맵·네이버지도 장소 검색으로 영업시간을 확인할 수 있다(D-039).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { remainingLabel } from '@jeomsimhabui/room-core';
import { Avatar } from '../../components/Avatar';
import { Icon } from '../../components/Icon';
import { Button, Header, Loading, Notice, Screen, SectionTitle, Sheet, Toast } from '../../components/ui';
import { errorMessage, type NewCandidate } from '../../data/room-repo';
import { blockedSummary, groupSummaryChips, PLACE_DISCLAIMER, tagLabel, type Evaluated, type NearbyPlace } from '../../domain';
import { NearbyMap } from '../location/NearbyMap';
import { MapLinks, PlaceDetailSheet } from '../location/PlaceDetailSheet';
import { LOCATION_NOTICE, locationErrorText, useMyLocation, useNearbyPlaces } from '../location/useMyLocation';
import { copyText, createRoomLink, shareMessage } from '../../platform/toss';
import { participantIndex, useRecommendation, useRoom } from '../room/useRoom';
import { AddCandidateSheet, nearbyToCandidate } from './AddCandidateSheet';
import { metaLine, PlaceCard } from './PlaceCard';

export function Candidates() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { view, repo, error, reload, expired, isHost } = useRoom(id);
  const rec = useRecommendation(view);
  const { location, state: locState, locate } = useMyLocation();
  const nearby = useNearbyPlaces(location);
  const [showMap, setShowMap] = useState(false);
  const [mapSelected, setMapSelected] = useState<NearbyPlace | null>(null);
  const [detail, setDetail] = useState<Evaluated | null>(null);
  const [showRest, setShowRest] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberName, setMemberName] = useState('');
  const existing = useMemo(() => new Set((view?.candidates ?? []).map((c) => c.placeId).filter((x): x is string => !!x)), [view]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  // 투표 중·결정된 방으로 들어오면 해당 화면으로
  useEffect(() => {
    if (view?.room.status === 'VOTING') navigate(`/room/${view.room.id}/vote`, { replace: true });
    if (view?.room.status === 'DECIDED') navigate(`/room/${view.room.id}/result`, { replace: true });
  }, [view?.room.status, view?.room.id, navigate]);

  if (error) {
    return (
      <Screen>
        <Header title="추천 결과" />
        <p className="empty">{error}</p>
        <Button variant="outline" onClick={() => navigate('/', { replace: true })}>홈으로</Button>
      </Screen>
    );
  }
  if (!view || !rec) return <Screen><Header title="추천 결과" /><Loading /></Screen>;

  const chips = groupSummaryChips(view.group);
  const notReady = view.participants.filter((p) => !p.isReady).length;

  const add = async (c: NewCandidate) => {
    try {
      await repo.addCandidate(view.room.id, view.meId, c);
      await reload();
      flash(`'${c.name}'을(를) 후보에 넣었어요`);
    } catch (e) {
      flash(errorMessage(e));
    }
  };

  const invite = async () => {
    const token = await repo.inviteToken(view.room.id);
    if (!token) return;
    try {
      const link = await createRoomLink(token);
      const how = await shareMessage(`점심합의 - 같이 정하는 오늘 점심\n오늘 점심, 우리끼리 빠르게 정하자. 내 조건만 넣어 줘!\n${link}`);
      if (how === 'copied') flash('초대 문구를 복사했어요');
    } catch {
      flash('공유하지 못했어요. 방 코드를 알려 주세요.');
    }
  };

  // window.prompt는 WebView에서 막힐 수 있어 바텀시트로 받는다
  const addMember = async () => {
    try {
      const pid = await repo.addParticipant(view.room.id, memberName);
      setMemberOpen(false);
      setMemberName('');
      navigate(`/room/${view.room.id}/pref/${pid}`);
    } catch (e) {
      flash(errorMessage(e));
    }
  };

  const startVote = async () => {
    if (rec.top.length === 0) return flash('후보를 먼저 추가해 주세요.');
    try {
      await repo.setStatus(view.room.id, 'VOTING');
      navigate(`/room/${view.room.id}/vote`);
    } catch (e) {
      flash(errorMessage(e));
    }
  };

  return (
    <Screen
      footer={
        isHost ? (
          <Button onClick={startVote} disabled={expired || rec.top.length === 0} icon="vote">
            {rec.top.length > 0 ? `추천 ${rec.top.length}곳으로 투표 시작` : '후보를 추가해 주세요'}
          </Button>
        ) : (
          <p className="caption caption--center">방장이 투표를 시작하면 이 화면이 투표로 바뀌어요.</p>
        )
      }
    >
      <Header
        title="추천 결과"
        right={
          <button type="button" className="header__action" onClick={() => void reload()}>
            <Icon name="refresh" size={16} /> 새로고침
          </button>
        }
      />

      <div className="room-head">
        <div>
          <strong>{view.room.title}</strong>
          <small>
            {view.room.meetingText ? `${view.room.meetingText} · ` : ''}{expired ? '마감됨' : `${remainingLabel(view.room.expiresAt)} 남음`}
            {view.mode === 'remote' && ` · 코드 ${view.room.shortCode}`}
          </small>
        </div>
        {view.mode === 'remote' && isHost && (
          <Button variant="outline" small icon="share" onClick={invite}>
            초대
          </Button>
        )}
      </div>

      <div className="card">
        <div className="card__row">
          <strong>조건 입력</strong>
          <span className="muted">
            {view.participants.length - notReady}/{view.participants.length}명 완료
          </span>
        </div>
        <div className="avatar-row">
          {view.participants.map((p) => {
            const canEdit = view.mode === 'local' || p.id === view.meId;
            return (
              <button
                key={p.id}
                type="button"
                className={`avatar-cell${p.isReady ? ' avatar-cell--ready' : ''}`}
                onClick={() => canEdit && navigate(`/room/${view.room.id}/pref/${p.id}`)}
                disabled={!canEdit}
                aria-label={`${p.nickname} ${p.isReady ? '입력 완료' : '입력 전'}`}
              >
                <Avatar index={participantIndex(view, p.id)} host={p.id === view.room.hostParticipantId} size={40} />
                <small>{p.id === view.meId ? '나' : p.nickname}</small>
                {p.isReady && <span className="ready-dot"><Icon name="check" size={10} strokeWidth={3} /></span>}
              </button>
            );
          })}
          {view.mode === 'local' && view.participants.length < 6 && (
            <button
              type="button"
              className="avatar-add"
              aria-label="참가자 추가"
              onClick={() => setMemberOpen(true)}
            >
              <Icon name="plus" size={20} />
            </button>
          )}
        </div>
        {view.mode === 'local' && <p className="caption">이름을 눌러 각자 조건을 입력해 주세요.</p>}
      </div>

      {chips.length > 0 && (
        <div className="chips chips--static" aria-label="그룹 조건">
          {chips.map((c) => (
            <span key={c} className="chip chip--static">{c}</span>
          ))}
        </div>
      )}

      <SectionTitle right={<span className="muted">후보 {view.candidates.length}곳</span>}>추천 후보</SectionTitle>
      {rec.top.length > 0 ? (
        <ul className="card-list">
          {rec.top.map((r, i) => (
            <li key={r.candidate.id}>
              <PlaceCard e={r} rank={i + 1} reason={r.reasons[0]?.includes('명이 원한') ? r.reasons[0] : undefined} onClick={() => setDetail(r)} />
            </li>
          ))}
        </ul>
      ) : null}

      {rec.insufficient && (
        <Notice tone="warn">
          {view.candidates.length === 0
            ? '아직 후보가 없어요. 주변 음식점에서 고르거나 직접 추가해 주세요.'
            : '조건에 맞는 후보가 부족해요. ' + (blockedSummary(rec.blocked).join(' · ') || '후보를 더 추가해 주세요.')}
        </Notice>
      )}

      {rec.rest.length > 0 && (
        <>
          <Button variant="muted" onClick={() => setShowRest(!showRest)}>
            {showRest ? '다른 후보 접기' : `다른 후보 보기 (${rec.rest.length})`}
          </Button>
          {showRest && (
            <ul className="card-list">
              {rec.rest.map((r) => (
                <li key={r.candidate.id}>
                  <PlaceCard e={r} onClick={() => setDetail(r)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Button variant="outline" icon="plus" onClick={() => setAdding(true)} disabled={expired}>
        후보 추가하기
      </Button>

      <SectionTitle
        right={
          location ? (
            <button type="button" className="text-link" onClick={() => setShowMap(!showMap)}>
              {showMap ? '지도 접기' : '지도 펼치기'}
            </button>
          ) : undefined
        }
      >
        내 주변 지도
      </SectionTitle>
      {!location ? (
        <div className="card">
          <p className="caption">{LOCATION_NOTICE}</p>
          <Button
            variant="outline"
            icon="pin"
            disabled={locState === 'locating'}
            onClick={async () => {
              await locate();
              setShowMap(true);
            }}
          >
            {locState === 'locating' ? '위치 확인 중…' : '내 위치로 지도 보기'}
          </Button>
          {locationErrorText(locState) && <p className="caption caption--warn">{locationErrorText(locState)}</p>}
        </div>
      ) : (
        showMap &&
        (nearby?.status === 'ok' ? (
          <>
            <NearbyMap
              center={location}
              pins={nearby.places.map((n) => {
                const ri = rec.top.findIndex((r) => r.candidate.placeId === n.place.id);
                return { nearby: n, inRoom: existing.has(n.place.id), rank: ri >= 0 ? ri + 1 : undefined };
              })}
              selectedId={mapSelected?.place.id}
              onSelect={setMapSelected}
            />
            <p className="caption">노란 핀은 이 방 후보, 숫자는 추천 순위예요. 핀을 누르면 영업시간을 지도 앱에서 확인할 수 있어요.</p>
          </>
        ) : nearby == null ? (
          <p className="loading">주변 음식점을 불러오는 중…</p>
        ) : (
          <p className="empty">{nearby.status === 'error' ? '주변 음식점을 불러오지 못했어요.' : '아직 음식점 데이터가 준비되지 않았어요. 후보를 직접 추가해 주세요.'}</p>
        ))
      )}

      <p className="caption">{PLACE_DISCLAIMER}</p>
      {view.group.cannotEat.length > 0 && <p className="caption caption--warn">'메뉴 확인 필요' 후보는 가게에서 메뉴를 꼭 확인해 주세요.</p>}

      <AddCandidateSheet open={adding} onClose={() => setAdding(false)} onAdd={add} existingPlaceIds={existing} />
      <PlaceDetailSheet
        nearby={mapSelected}
        onClose={() => setMapSelected(null)}
        added={mapSelected ? existing.has(mapSelected.place.id) : false}
        onAdd={
          expired
            ? undefined
            : async (n) => {
                setMapSelected(null);
                await add(nearbyToCandidate(n));
              }
        }
      />
      <Sheet open={!!detail} title={detail?.candidate.name ?? ''} onClose={() => setDetail(null)}>
        {detail && (
          <>
            <p className="sub">{metaLine(detail)}</p>
            {detail.candidate.address && <p className="caption">{detail.candidate.address}</p>}
            <p className="caption">
              {detail.candidate.source === 'PUBLIC_DATA' ? '공공데이터에서 고른 곳' : '직접 입력한 곳'}
              {detail.walkMin != null ? ' · 도보 시간은 추가한 사람 위치 기준 추정' : ''}
              {detail.candidate.tags.length ? ` · ${detail.candidate.tags.map(tagLabel).join('·')}` : ''}
            </p>
            <MapLinks name={detail.candidate.name} address={detail.candidate.address} />
            <Notice>영업시간·오늘 영업 여부는 지도 앱에서 확인해 주세요.</Notice>
          </>
        )}
      </Sheet>
      <Sheet open={memberOpen} title="참가자 추가" onClose={() => setMemberOpen(false)} footer={<Button onClick={addMember} disabled={!memberName.trim()}>추가하고 조건 입력</Button>}>
        <input className="input" value={memberName} maxLength={10} onChange={(e) => setMemberName(e.target.value)} placeholder="이름(예: 서연)" aria-label="참가자 이름" autoFocus />
      </Sheet>
      <Toast message={toast} />
      {view.mode === 'remote' && (
        <button type="button" className="text-link" onClick={() => void copyText(view.room.shortCode).then(() => flash('방 코드를 복사했어요'))}>
          방 코드 복사
        </button>
      )}
    </Screen>
  );
}
