// 링크(?t=토큰) 또는 6자리 코드(?code=)로 공유 방 참여. 가입 없이 닉네임만.
// 참여 전 "이 방 참여자와 서버에 공유돼요" 안내(프롬프트 §7-4). 링크 입력은 신뢰하지 않는다 — 형식이 틀리면 조용히 홈으로.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isValidToken, normalizeShortCode } from '@jeomsimhabui/room-core';
import { Button, Header, Notice, Screen, Toast } from '../../components/ui';
import { errorMessage, joinRemote, remoteConfigured } from '../../data/room-repo';

export function Join() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('t');
  const code = normalizeShortCode(params.get('code') ?? '');
  const valid = isValidToken(token) || !!code;
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!valid) navigate('/', { replace: true });
  }, [valid, navigate]);

  if (!valid) return null;

  if (!remoteConfigured()) {
    return (
      <Screen>
        <Header title="방 참여하기" />
        <Notice tone="warn">아직 공유 방 서버가 연결되지 않은 버전이에요. 방장의 기기에서 함께 입력해 주세요(한 기기 모드).</Notice>
        <Button variant="outline" onClick={() => navigate('/', { replace: true })}>홈으로</Button>
      </Screen>
    );
  }

  const join = async () => {
    setBusy(true);
    try {
      const roomId = await joinRemote(isValidToken(token) ? { token } : { code: code! }, nickname);
      navigate(`/room/${roomId}`, { replace: true });
    } catch (e) {
      setToast(errorMessage(e));
      setTimeout(() => setToast(null), 2500);
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button onClick={join} disabled={busy || !nickname.trim()}>참여하고 내 조건 넣기</Button>}>
      <Header title="방 참여하기" />
      <h1 className="title">
        같이 점심 정해요!
        <br />
        이름만 알려 주세요
      </h1>
      <label className="field">
        <span>닉네임(1~10자)</span>
        <input className="input" value={nickname} maxLength={10} onChange={(e) => setNickname(e.target.value)} placeholder="예: 지민" autoFocus />
      </label>
      <Notice>
        닉네임·예산·먹고 싶은 것·못 먹는 것·투표가 이 방 참여자와 서버에 공유돼요. 다른 사람에게는 그룹 요약만 보이고, 방이 마감되면(당일 23:59 또는 12시간 뒤) 서버에서 지워져요.
      </Notice>
      <Toast message={toast} />
    </Screen>
  );
}
