// 온보딩 06 '공유 & 기록': 닫기(X) · 결정 카드 · 링크 복사하기(남색) · 메시지로 공유하기(외곽선) · 최근 이용 기록.
// 카카오톡 직접 연동은 외부 앱 이동 규칙 확인 전이라 쓰지 않고, 토스 공유 시트(Share.sendMessage)로 보낸다(D-014).
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FoodThumb } from '../../components/FoodThumb';
import { Icon } from '../../components/Icon';
import { Button, Header, Loading, Screen, SectionTitle, Toast } from '../../components/ui';
import { tagLabel } from '../../domain';
import { copyText, createRoomLink, shareMessage } from '../../platform/toss';
import { listDecisions, type DecisionRecord } from '../../storage/records';
import { useRoom } from '../room/useRoom';

export function ShareScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { view, repo } = useRoom(id);
  const [history, setHistory] = useState<DecisionRecord[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    listDecisions().then(setHistory);
  }, []);

  if (!view) return <Screen><Header title="결과 공유하기" leading="close" /><Loading /></Screen>;
  const place = view.candidates.find((c) => c.id === view.room.decidedCandidateId);
  if (!place) return <Screen><Header title="결과 공유하기" leading="close" /><p className="empty">아직 결정된 곳이 없어요.</p></Screen>;

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2000);
  };

  const kind = place.tags.map(tagLabel).join('·') || '종류 미확인';
  const text = `점심합의 - 같이 정하는 오늘 점심\n오늘 점심은 '${place.name}'(${kind})로 정했어요!${place.address ? `\n${place.address}` : ''}`;

  const link = async () => {
    const token = await repo.inviteToken(view.room.id);
    return token ? createRoomLink(token) : null;
  };

  const copy = async () => {
    try {
      const l = await link();
      await copyText(l ? `${text}\n${l}` : text);
      flash(l ? '링크를 복사했어요' : '결과를 복사했어요');
    } catch {
      flash('복사하지 못했어요');
    }
  };

  const send = async () => {
    try {
      const l = await link();
      const how = await shareMessage(l ? `${text}\n${l}` : text);
      if (how === 'copied') flash('공유 문구를 복사했어요');
    } catch {
      flash('공유하지 못했어요');
    }
  };

  return (
    <Screen>
      <Header title="결과 공유하기" leading="close" onBack={() => navigate(`/room/${view.room.id}/result`, { replace: true })} />
      <div className="share-card">
        <FoodThumb tags={place.tags} size={64} />
        <span className="place-card__text">
          <strong>{place.name}</strong>
          <small>
            {kind}
            {place.priceHint != null ? ` · ${place.priceHint.toLocaleString('ko-KR')}원(직접 입력)` : ''}
          </small>
          <small className="faint">점심합의에서 결정한 오늘의 점심이에요!</small>
        </span>
      </div>

      <div className="stack">
        <Button icon="copy" onClick={copy}>
          {view.mode === 'remote' ? '링크 복사하기' : '결과 복사하기'}
        </Button>
        <Button variant="outline" icon="chat" onClick={send}>
          메시지로 공유하기
        </Button>
      </div>

      <SectionTitle right={history.length > 0 ? <button type="button" className="text-link" onClick={() => navigate('/history')}>전체 보기</button> : undefined}>
        최근 이용 기록
      </SectionTitle>
      {history.length === 0 ? (
        <p className="empty">아직 기록이 없어요.</p>
      ) : (
        <ul className="card-list">
          {history.slice(0, 3).map((h) => (
            <li key={h.roomId} className="list-card">
              <FoodThumb tags={h.tags} size={40} />
              <span className="list-card__text">
                <strong>{h.placeName}</strong>
                <small>
                  {h.roomTitle} · {h.decidedAt.slice(0, 10).replace(/-/g, '.')}
                </small>
              </span>
              <Icon name="chevron" size={16} className="row__chevron" />
            </li>
          ))}
        </ul>
      )}
      <Toast message={toast} />
    </Screen>
  );
}
