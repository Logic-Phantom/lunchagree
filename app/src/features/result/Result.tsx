// 온보딩 05 '결과 확인': 축하 마크 · "최종 결정!" · 한 줄 정보 · 멤버별 참여 정보 · "우리의 점심, 성공적!".
// 동률이면 자동으로 정하지 않는다 → 방장이 고르거나 다시 투표.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ResultBanner } from '../../ads/ResultBanner';
import { Avatar } from '../../components/Avatar';
import { Icon } from '../../components/Icon';
import { Button, Header, Loading, Notice, Screen, SectionTitle, Toast } from '../../components/ui';
import { errorMessage } from '../../data/room-repo';
import { MENU_CHECK_NOTICE, outcomeFromCounts } from '../../domain';
import { addDecision } from '../../storage/records';
import { metaLine, PlaceCard } from '../candidates/PlaceCard';
import { useMyLocation } from '../location/useMyLocation';
import { participantIndex, useRecommendation, useRoom } from '../room/useRoom';

/** 그릇 + 김 + 반짝임(아이콘의 노란 포인트를 살린 자체 그림). */
export function CelebrateMark() {
  return (
    <svg className="celebrate" width="132" height="96" viewBox="0 0 132 96" aria-hidden="true">
      <g stroke="var(--color-yellow)" strokeWidth="4" strokeLinecap="round">
        <path d="M22 30l10 6M14 52h12M110 30l-10 6M106 52h12" />
      </g>
      <g stroke="var(--color-text-faint)" strokeWidth="3" strokeLinecap="round">
        <path d="M40 12l4 8M92 12l-4 8" />
      </g>
      <path d="M36 50h60a30 30 0 0 1-60 0z" fill="var(--color-ink)" />
      <path d="M54 22c-3 5 3 8 0 14M66 18c-3 5 3 8 0 14M78 22c-3 5 3 8 0 14" stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M50 66a18 10 0 0 0 32 0" stroke="var(--color-yellow)" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Result() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { view, repo, error, reload, isHost } = useRoom(id);
  const { location } = useMyLocation();
  const rec = useRecommendation(view, location);
  const [toast, setToast] = useState<string | null>(null);
  const saved = useRef(false);

  const decided = view?.room.status === 'DECIDED' ? (rec ? [...rec.top, ...rec.rest].find((r) => r.candidate.id === view.room.decidedCandidateId) : null) : null;
  const decidedRaw = view?.candidates.find((c) => c.id === view.room.decidedCandidateId) ?? null;

  // 결정 기록(기기 로컬)
  useEffect(() => {
    if (!view || !decidedRaw || saved.current) return;
    saved.current = true;
    void addDecision({ roomId: view.room.id, roomTitle: view.room.title, placeName: decidedRaw.name, tags: decidedRaw.tags, decidedAt: new Date().toISOString() });
  }, [view, decidedRaw]);

  if (error) return <Screen><Header title="결과" /><p className="empty">{error}</p></Screen>;
  if (!view || !rec) return <Screen><Header title="결과" /><Loading /></Screen>;

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2000);
  };

  // 아직 결정 전: 동률 처리
  if (view.room.status !== 'DECIDED' || !decidedRaw) {
    const ids = rec.top.map((r) => r.candidate.id);
    const outcome = outcomeFromCounts(view.voteCounts, ids);
    const tied = outcome.kind === 'TIE' ? rec.top.filter((r) => outcome.candidateIds.includes(r.candidate.id)) : [];
    return (
      <Screen>
        <Header title="투표 결과" />
        {outcome.kind === 'TIE' ? (
          <>
            <h1 className="title">동률이에요!</h1>
            <p className="sub">{tied.length}곳이 {view.voteCounts[tied[0].candidate.id]}표로 같아요. 자동으로 정하지 않아요.</p>
            <ul className="card-list">
              {tied.map((r) => (
                <li key={r.candidate.id}>
                  <PlaceCard
                    e={r}
                    onClick={
                      isHost
                        ? async () => {
                            try {
                              await repo.setStatus(view.room.id, 'DECIDED', r.candidate.id);
                              await reload();
                            } catch (e) {
                              flash(errorMessage(e));
                            }
                          }
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
            {isHost ? (
              <>
                <p className="caption">방장이 하나를 누르면 그곳으로 정해져요.</p>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await repo.setStatus(view.room.id, 'COLLECTING');
                    await repo.setStatus(view.room.id, 'VOTING');
                    navigate(`/room/${view.room.id}/vote`, { replace: true });
                  }}
                >
                  다시 투표하기
                </Button>
              </>
            ) : (
              <p className="caption">방장이 정하거나 다시 투표를 열 거예요.</p>
            )}
          </>
        ) : (
          <>
            <p className="empty">아직 투표가 끝나지 않았어요.</p>
            <Button variant="outline" onClick={() => navigate(`/room/${view.room.id}/vote`)}>투표 화면으로</Button>
          </>
        )}
        <Toast message={toast} />
      </Screen>
    );
  }

  const meta = decided ? metaLine(decided) : decidedRaw.name;
  return (
    <Screen
      className="result"
      footer={
        <div className="stack">
          <Button icon="share" onClick={() => navigate(`/room/${view.room.id}/share`)}>결과 공유하기</Button>
          <Button variant="muted" onClick={() => navigate('/', { replace: true })}>홈으로</Button>
        </div>
      }
    >
      <Header leading="none" />
      <section className="result__hero">
        <CelebrateMark />
        <h1 className="title">
          최종 결정!
          <br />
          {decidedRaw.name}
        </h1>
        <p className="result__meta">
          <Icon name="crown" size={16} className="crown" /> {meta}
        </p>
        <p className="caption caption--center">모두의 조건을 모아 함께 고른 오늘의 점심이에요 🎉</p>
      </section>

      {decided?.needsMenuCheck && <Notice tone="warn">{MENU_CHECK_NOTICE}</Notice>}

      <SectionTitle right={<span className="muted">{view.participants.length}명</span>}>멤버별 참여 정보</SectionTitle>
      <ul className="member-list">
        {view.participants.map((p) => (
          <li key={p.id}>
            <Avatar index={participantIndex(view, p.id)} host={p.id === view.room.hostParticipantId} size={32} />
            <strong>{p.id === view.meId ? '나' : p.nickname}</strong>
            <small>
              {p.isReady ? '조건 입력 완료' : '조건 미입력'} · {p.hasVoted ? '투표 완료' : '투표 안 함'}
            </small>
          </li>
        ))}
      </ul>

      <div className="success-pill">
        <Avatar index={0} host size={28} />
        <span>우리의 점심, 성공적!</span>
      </div>
      <ResultBanner />
      <Toast message={toast} />
    </Screen>
  );
}
