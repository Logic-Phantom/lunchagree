// 온보딩 04 '식당 투표': 1/3 넘김 · 큰 카드 · 투표한 사람 수 · 투표하기(남색) · 다른 후보 보기.
// 1인 1표, 다시 누르면 바뀐다. 한 기기 모드에서는 "누구의 투표인지" 고르고 누른다.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, AvatarStack } from '../../components/Avatar';
import { FoodThumb } from '../../components/FoodThumb';
import { Button, Header, Loading, Screen, Toast } from '../../components/ui';
import { errorMessage } from '../../data/room-repo';
import { outcomeFromCounts, voteStatusLabel } from '../../domain';
import { metaLine } from '../candidates/PlaceCard';
import { participantIndex, useNearby, useRecommendation, useRoom } from '../room/useRoom';

export function Vote() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { view, repo, error, reload, isHost } = useRoom(id);
  const { origin } = useNearby(view?.room.stationId ?? null);
  const rec = useRecommendation(view, origin);
  const [page, setPage] = useState(0);
  const [voter, setVoter] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2000);
  };

  useEffect(() => {
    if (view?.room.status === 'DECIDED') navigate(`/room/${view.room.id}/result`, { replace: true });
    if (view?.room.status === 'COLLECTING') navigate(`/room/${view.room.id}`, { replace: true });
  }, [view?.room.status, view?.room.id, navigate]);

  // 한 기기 모드: 아직 투표하지 않은 첫 사람을 기본 선택
  useEffect(() => {
    if (!view) return;
    if (view.mode === 'remote') setVoter(view.meId);
    else if (!voter || !view.participants.some((p) => p.id === voter)) setVoter(view.participants.find((p) => !p.hasVoted)?.id ?? view.meId);
  }, [view, voter]);

  if (error) return <Screen><Header title="식당 투표" /><p className="empty">{error}</p></Screen>;
  if (!view || !rec || !voter) return <Screen><Header title="식당 투표" /><Loading /></Screen>;

  const list = rec.top;
  if (list.length === 0) return <Screen><Header title="식당 투표" /><p className="empty">투표할 후보가 없어요.</p></Screen>;
  const cur = list[Math.min(page, list.length - 1)];
  const voted = view.participants.filter((p) => p.hasVoted);
  const voterVote = view.mode === 'remote' ? view.myVote : (view.votesBy[voter] ?? null);
  const isMine = voterVote === cur.candidate.id;
  const voterName = view.participants.find((p) => p.id === voter)?.nickname ?? '나';

  const cast = async () => {
    try {
      await repo.castVote(view.room.id, voter, cur.candidate.id);
      await reload();
      flash(`${voter === view.meId ? '' : `${voterName} · `}'${cur.candidate.name}'에 투표했어요`);
      if (view.mode === 'local') {
        const next = view.participants.find((p) => p.id !== voter && !p.hasVoted);
        if (next) {
          setVoter(next.id);
          setPage(0);
        }
      }
    } catch (e) {
      flash(errorMessage(e));
    }
  };

  const finish = async () => {
    const outcome = outcomeFromCounts(view.voteCounts, list.map((r) => r.candidate.id));
    if (outcome.kind === 'NO_VOTES') return flash('아직 투표가 없어요.');
    try {
      // 동률이면 결정하지 않고 결과 화면에서 방장이 고르거나 재투표
      if (outcome.kind === 'WINNER') await repo.setStatus(view.room.id, 'DECIDED', outcome.candidateId);
      navigate(`/room/${view.room.id}/result`);
    } catch (e) {
      flash(errorMessage(e));
    }
  };

  return (
    <Screen
      footer={
        isHost ? (
          <Button variant="text" onClick={finish} disabled={voted.length === 0}>
            투표 마감하고 결과 보기
          </Button>
        ) : undefined
      }
    >
      <Header title="식당 투표" right={<span className="pager">{page + 1}/{list.length}</span>} />

      {view.mode === 'local' && (
        <div className="voter-pick" role="radiogroup" aria-label="누구의 투표인가요?">
          <span className="muted">누구의 투표인가요?</span>
          <div className="avatar-row">
            {view.participants.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={voter === p.id}
                className={`avatar-cell${voter === p.id ? ' avatar-cell--on' : ''}${p.hasVoted ? ' avatar-cell--ready' : ''}`}
                onClick={() => setVoter(p.id)}
              >
                <Avatar index={participantIndex(view, p.id)} host={p.id === view.room.hostParticipantId} size={36} />
                <small>{p.id === view.meId ? '나' : p.nickname}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <article className="vote-card">
        <FoodThumb tags={cur.candidate.tags} wide />
        <div className="vote-card__body">
          <h2>{cur.candidate.name}</h2>
          <p className="muted">{metaLine(cur)}</p>
          {cur.reasons[0]?.includes('명이 원한') && <p className="vote-card__reason">{cur.reasons[0]}</p>}
          {cur.needsMenuCheck && <span className="badge badge--warn">메뉴 확인 필요</span>}
          <div className="vote-card__voters">
            {voted.length > 0 && <AvatarStack indices={voted.map((p) => ({ index: participantIndex(view, p.id), host: p.id === view.room.hostParticipantId }))} />}
            <span className="muted">{voteStatusLabel(voted.length, view.participants.length)}</span>
          </div>
          <div className="stack">
            <Button icon="vote" onClick={cast} disabled={isMine}>
              {isMine ? '투표했어요' : '투표하기'}
            </Button>
            <Button variant="muted" onClick={() => setPage((page + 1) % list.length)}>
              다른 후보 보기
            </Button>
          </div>
        </div>
      </article>

      <div className="dots" aria-hidden="true">
        {list.map((r, i) => (
          <span key={r.candidate.id} className={i === page ? 'on' : ''} />
        ))}
      </div>
      <Toast message={toast} />
    </Screen>
  );
}
