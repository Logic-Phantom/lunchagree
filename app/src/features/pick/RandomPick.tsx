// 랜덤 뽑기: 방·투표 없이 내 조건에 맞는 주변 음식점 하나를 뽑는다(D-051). 계산은 기기 안에서만 하고 위치는 저장·전송하지 않는다(D-041).
// 공공데이터에는 가격이 없어 예산으로 거를 수 없다 → 예산은 묻지 않고 그렇다고 알려 준다. 조건에 맞는 곳이 없으면 없다고 안내한다.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Header, Notice, Screen, SectionTitle, Toast } from '../../components/ui';
import { aggregatePreferences, blockedSummary, PLACE_DISCLAIMER, pickRandomNearby, type RandomPick as PickResult } from '../../domain';
import { logEvent } from '../../platform/toss';
import { addDecision, loadDefaultPreference, saveDefaultPreference } from '../../storage/records';
import { metaLine, PlaceCard } from '../candidates/PlaceCard';
import { MapLinks } from '../location/PlaceDetailSheet';
import { LOCATION_NOTICE, locationErrorText, useMyLocation, useNearbyPlaces } from '../location/useMyLocation';
import { ConditionEditor, EMPTY_PREFERENCE, type PreferenceValue } from '../preferences/ConditionEditor';

export function RandomPick() {
  const navigate = useNavigate();
  const { location, state, locate } = useMyLocation();
  const nearby = useNearbyPlaces(location);
  const [pref, setPref] = useState<PreferenceValue>(EMPTY_PREFERENCE);
  const [result, setResult] = useState<PickResult | null>(null);
  const [wantPick, setWantPick] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadDefaultPreference().then((p) => p && setPref(p));
  }, []);

  const draw = () => {
    if (!location || nearby?.status !== 'ok') return;
    const group = aggregatePreferences([{ participantId: 'me', ...pref }], 1);
    setResult(pickRandomNearby(nearby.places, group, location, { lastId: result?.pick?.nearby.place.id }));
    setWantPick(false);
  };

  // 위치·타일이 준비되면 누른 뽑기를 이어서 실행한다
  useEffect(() => {
    if (wantPick && nearby?.status === 'ok') draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantPick, nearby]);

  const onDraw = async () => {
    void saveDefaultPreference(pref);
    setWantPick(true);
    if (!location) await locate();
  };

  // 위치를 못 얻으면 대기를 풀어 버튼을 되살린다
  useEffect(() => {
    if (state === 'denied' || state === 'unavailable') setWantPick(false);
  }, [state]);

  const decide = async () => {
    const pick = result?.pick;
    if (!pick) return;
    await addDecision({ roomId: `pick-${Date.now()}`, roomTitle: '랜덤 뽑기', placeName: pick.rec.candidate.name, tags: pick.rec.candidate.tags, decidedAt: new Date().toISOString() });
    void logEvent('random_decided');
    setToast('결정 기록에 남겼어요');
    setTimeout(() => navigate('/', { replace: true }), 900);
  };

  const pick = result?.pick;
  const loading = wantPick && (state === 'locating' || nearby == null);
  const failed = nearby != null && nearby.status !== 'ok';

  return (
    <Screen
      footer={
        <Button icon="refresh" onClick={() => void onDraw()} disabled={loading || failed}>
          {loading ? '찾는 중…' : pick ? '다시 뽑기' : '랜덤으로 뽑기'}
        </Button>
      }
    >
      <Header title="랜덤으로 뽑기" />

      {pick && (
        <section className="stack" aria-live="polite">
          <SectionTitle>오늘은 여기 어때요?</SectionTitle>
          <PlaceCard e={pick.rec} reason={pick.nearby.place.tagSource === 'estimated' ? '종류는 이름으로 추정' : undefined} />
          {pick.rec.candidate.address && <p className="caption">{pick.rec.candidate.address}</p>}
          <p className="caption">조건에 맞는 {result!.pool.toLocaleString('ko-KR')}곳 중에서 뽑았어요. {metaLine(pick.rec).includes('가격 미확인') ? '가격·영업시간은 지도 앱에서 확인해 주세요.' : ''}</p>
          <MapLinks name={pick.rec.candidate.name} address={pick.rec.candidate.address} />
          <Button variant="outline" icon="check" onClick={() => void decide()}>여기로 결정</Button>
        </section>
      )}

      {result && !pick && (
        <Notice tone="warn">
          {nearby?.status === 'ok' && nearby.places.length === 0
            ? '반경 1km 안에서 찾은 음식점이 없어요.'
            : `조건에 맞는 주변 음식점이 없어요. ${blockedSummary(result.blocked).join(' · ')}`}
        </Notice>
      )}

      {failed && (
        <Notice tone="warn">{nearby?.status === 'error' ? '주변 음식점을 불러오지 못했어요. 잠시 후 다시 들어와 주세요.' : '아직 음식점 데이터가 준비되지 않았어요.'}</Notice>
      )}

      <SectionTitle>내 조건</SectionTitle>
      <ConditionEditor value={pref} onChange={setPref} hideBudget />
      <p className="caption">공공데이터에는 가격 정보가 없어 예산으로는 거를 수 없어요.</p>

      {!location && <p className="caption">{LOCATION_NOTICE}</p>}
      {locationErrorText(state) && <Notice tone="warn">{locationErrorText(state)}</Notice>}
      <p className="caption">{PLACE_DISCLAIMER}</p>
      <Toast message={toast} />
    </Screen>
  );
}
