// 온보딩 02 '새 방 만들기': 참가자(2~6명, 아바타 줄) · 모이는 곳(이름만, 선택) · 내 조건 입력하기 · "조건은 나중에 변경할 수 있어요."
// 음식점은 후보를 넣을 때 '내 위치 주변'에서 찾는다 — 방에는 좌표를 저장하지 않는다(D-037).
// 공유 방 서버가 있으면 방장만 넣고 나머지는 링크로 참여, 없으면 한 기기 모드로 참가자 이름을 직접 추가한다.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MAX_PARTICIPANTS, normalizeNickname } from '@jeomsimhabui/room-core';
import { Avatar } from '../../components/Avatar';
import { Icon } from '../../components/Icon';
import { Button, Header, Row, Screen, SectionTitle, Sheet, Toast } from '../../components/ui';
import { defaultMode, errorMessage, repoFor } from '../../data/room-repo';
import { logEvent } from '../../platform/toss';
import { loadDefaultPreference, saveDefaultPreference } from '../../storage/records';
import { ConditionEditor, EMPTY_PREFERENCE, type PreferenceValue } from '../preferences/ConditionEditor';

export function RoomCreate() {
  const navigate = useNavigate();
  const mode = defaultMode();
  const [title, setTitle] = useState('오늘 점심');
  const [others, setOthers] = useState<string[]>([]);
  const [meetingText, setMeetingText] = useState('');
  const [pref, setPref] = useState<PreferenceValue>(EMPTY_PREFERENCE);
  const [sheet, setSheet] = useState<'member' | 'place' | 'title' | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadDefaultPreference().then((p) => p && setPref(p));
  }, []);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  const addMember = () => {
    const n = normalizeNickname(nameInput);
    if (!n) return flash('이름은 1~10자로 입력해 주세요.');
    if (others.length + 1 >= MAX_PARTICIPANTS) return flash('최대 6명까지 함께할 수 있어요.');
    setOthers([...others, n]);
    setNameInput('');
    setSheet(null);
  };

  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await saveDefaultPreference(pref);
      const roomId = await repoFor(mode).create({
        title: title.trim() || '오늘 점심',
        meetingText: meetingText.trim() || null,
        returnBy: null,
        maxWalkMinutes: pref.maxWalkMinutes ?? 15,
        defaultBudget: pref.maxBudget,
        hostNickname: '나',
        hostPreference: pref,
        others,
      });
      void logEvent('room_created');
      navigate(`/room/${roomId}`, { replace: true });
    } catch (e) {
      flash(errorMessage(e));
      setBusy(false);
    }
  };

  const count = others.length + 1;
  const placeLabel = meetingText.trim() || '정하지 않음';

  return (
    <Screen
      footer={
        <Button onClick={create} disabled={busy}>
          {busy ? '만드는 중…' : '방 만들고 후보 보기'}
        </Button>
      }
    >
      <Header
        title="새 방 만들기"
        right={
          <button type="button" className="header__action" onClick={create} disabled={busy}>
            완료
          </button>
        }
      />

      <Row icon="doc" label="방 이름" value={title} onClick={() => setSheet('title')} />

      <SectionTitle>참가자</SectionTitle>
      <div className="card">
        <div className="card__row">
          <strong>{mode === 'remote' ? '2~6명' : `${count}명`}</strong>
          <span className="muted">{mode === 'remote' ? '방을 만든 뒤 링크로 초대해요' : '한 기기에서 돌려 가며 입력해요'}</span>
        </div>
        <div className="avatar-row">
          {mode === 'local' && (
            <button type="button" className="avatar-add" onClick={() => setSheet('member')} aria-label="참가자 추가" disabled={count >= MAX_PARTICIPANTS}>
              <Icon name="plus" size={20} />
            </button>
          )}
          <span className="avatar-cell">
            <Avatar index={0} host size={40} />
            <small>나</small>
          </span>
          {others.map((n, i) => (
            <button key={`${n}-${i}`} type="button" className="avatar-cell" onClick={() => setOthers(others.filter((_, j) => j !== i))} aria-label={`${n} 빼기`}>
              <Avatar index={i + 1} size={40} />
              <small>{n}</small>
            </button>
          ))}
        </div>
      </div>

      <SectionTitle>모이는 곳</SectionTitle>
      <div className="row-list">
        <Row icon="pin" label="모이는 곳" value={placeLabel} onClick={() => setSheet('place')} />
      </div>

      <SectionTitle>내 조건 입력하기</SectionTitle>
      <ConditionEditor value={pref} onChange={setPref} />
      <p className="caption caption--center">조건은 나중에 변경할 수 있어요.</p>

      <Sheet open={sheet === 'title'} title="방 이름" onClose={() => setSheet(null)} footer={<Button onClick={() => setSheet(null)}>확인</Button>}>
        <input className="input" value={title} maxLength={30} onChange={(e) => setTitle(e.target.value)} aria-label="방 이름" autoFocus />
      </Sheet>

      <Sheet open={sheet === 'member'} title="참가자 추가" onClose={() => setSheet(null)} footer={<Button onClick={addMember}>추가</Button>}>
        <p className="caption">한 기기 모드예요. 이 폰을 돌려 가며 각자 조건과 투표를 입력해요.</p>
        <input
          className="input"
          value={nameInput}
          maxLength={10}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addMember()}
          placeholder="이름(예: 지민)"
          aria-label="참가자 이름"
          autoFocus
        />
      </Sheet>

      <Sheet open={sheet === 'place'} title="모이는 곳" onClose={() => setSheet(null)} footer={<Button onClick={() => setSheet(null)}>확인</Button>}>
        <input className="input" value={meetingText} maxLength={40} onChange={(e) => setMeetingText(e.target.value)} placeholder="예: 본관 1층 로비" aria-label="모이는 곳" autoFocus />
        <p className="caption">참가자에게 보이는 이름일 뿐이에요. 주변 음식점은 후보를 넣을 때 내 위치를 기준으로 찾아요.</p>
      </Sheet>
      <Toast message={toast} />
    </Screen>
  );
}
