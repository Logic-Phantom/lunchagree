// 참가자 한 명의 조건 입력(공유 방: 나, 한 기기 모드: 고른 참가자).
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { Button, Header, Loading, Screen, Toast } from '../../components/ui';
import { errorMessage } from '../../data/room-repo';
import { saveDefaultPreference } from '../../storage/records';
import { participantIndex, useRoom } from '../room/useRoom';
import { ConditionEditor, EMPTY_PREFERENCE, type PreferenceValue } from './ConditionEditor';

export function PreferenceScreen() {
  const { id, pid } = useParams();
  const navigate = useNavigate();
  const { view, repo, error } = useRoom(id);
  const [pref, setPref] = useState<PreferenceValue | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!view || pref || !pid) return;
    const saved = view.preferences[pid];
    setPref(saved ? { maxBudget: saved.maxBudget, likes: saved.likes, cannotEat: saved.cannotEat, maxWalkMinutes: saved.maxWalkMinutes } : EMPTY_PREFERENCE);
  }, [view, pid, pref]);

  if (error) return <Screen><Header title="내 조건" /><p className="empty">{error}</p></Screen>;
  if (!view || !pref || !pid) return <Screen><Header title="내 조건" /><Loading /></Screen>;
  const person = view.participants.find((p) => p.id === pid);
  if (!person) return <Screen><Header title="내 조건" /><p className="empty">참가자를 찾을 수 없어요.</p></Screen>;
  const isMe = pid === view.meId;

  const save = async () => {
    setBusy(true);
    try {
      await repo.savePreference(view.room.id, pid, pref);
      if (isMe) await saveDefaultPreference(pref);
      navigate(-1);
    } catch (e) {
      setToast(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button onClick={save} disabled={busy}>저장하기</Button>}>
      <Header title={isMe ? '내 조건 입력하기' : `${person.nickname}의 조건`} />
      <div className="person-head">
        <Avatar index={participantIndex(view, pid)} host={pid === view.room.hostParticipantId} size={48} />
        <div>
          <strong>{person.nickname}</strong>
          <small>{view.mode === 'remote' ? '이 방 참여자와 서버에 그룹 요약으로만 공유돼요' : '이 기기에만 저장돼요'}</small>
        </div>
      </div>
      <ConditionEditor value={pref} onChange={setPref} />
      <p className="caption caption--center">다른 사람에게는 누가 무엇을 골랐는지 보이지 않아요.</p>
      <Toast message={toast} />
    </Screen>
  );
}
