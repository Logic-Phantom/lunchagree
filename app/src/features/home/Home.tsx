// 온보딩 01 '방 만들기' 화면: 로고 · 큰 제목 · 새 방 만들기(남색) · 링크로 참여하기(외곽선) · 최근 이용한 방.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractToken, isExpired, normalizeShortCode } from '@jeomsimhabui/room-core';
import { Avatar } from '../../components/Avatar';
import { Icon } from '../../components/Icon';
import { Button, Sheet } from '../../components/ui';
import { remoteConfigured } from '../../data/room-repo';
import { listRecentRooms, relativeTime, type RecentRoom } from '../../storage/records';

export function Home() {
  const navigate = useNavigate();
  const [recent, setRecent] = useState<RecentRoom[]>([]);
  const [joinOpen, setJoinOpen] = useState(false);
  const [input, setInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    listRecentRooms().then(setRecent);
  }, []);

  const submitJoin = () => {
    const token = extractToken(input);
    if (token) return navigate(`/join?t=${token}`);
    const code = normalizeShortCode(input);
    if (code) return navigate(`/join?code=${code}`);
    setJoinError('링크나 6자리 코드를 확인해 주세요.');
  };

  return (
    <div className="screen home">
      <header className="home__bar">
        <span className="brand">
          <img src="./brand/logo.png" alt="" width={26} height={26} />
          <strong>점심합의</strong>
        </span>
        <button type="button" className="header__icon" onClick={() => navigate('/settings')} aria-label="설정">
          <Icon name="settings" />
        </button>
      </header>

      <main className="screen__body">
        <section className="home__hero">
          <h1 className="display">
            오늘 점심,
            <br />
            어디로 갈까요?
          </h1>
          <p className="sub">오늘 점심, 우리끼리 빠르게 정하자.</p>
          <p className="feature-line">조건 모으기 · 식당 추천 · 다 같이 투표</p>
        </section>

        <div className="stack">
          <Button onClick={() => navigate('/create')}>새 방 만들기</Button>
          <Button variant="outline" icon="link" onClick={() => setJoinOpen(true)}>
            링크로 참여하기
          </Button>
        </div>

        <section className="panel">
          <h2 className="panel__title">최근 이용한 방</h2>
          {recent.length === 0 ? (
            <p className="empty">아직 만든 방이 없어요. 새 방을 만들어 동료에게 공유해 보세요.</p>
          ) : (
            <ul className="card-list">
              {recent.slice(0, 3).map((r, i) => {
                const done = isExpired(r.expiresAt);
                return (
                  <li key={r.roomId}>
                    <button type="button" className="list-card" onClick={() => navigate(`/room/${r.roomId}`)} disabled={done && r.mode === 'remote'}>
                      <Avatar index={i + 1} size={36} />
                      <span className="list-card__text">
                        <strong>{r.title}</strong>
                        <small>
                          {r.participantCount}명 · {done ? '마감' : relativeTime(r.updatedAt)}
                        </small>
                      </span>
                      <Icon name="chevron" size={16} className="row__chevron" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {recent.length > 0 && (
            <button type="button" className="text-link" onClick={() => navigate('/history')}>
              결정 기록 보기
            </button>
          )}
        </section>
      </main>

      <Sheet
        open={joinOpen}
        title="링크로 참여하기"
        onClose={() => setJoinOpen(false)}
        footer={<Button onClick={submitJoin} disabled={!input.trim()}>참여하기</Button>}
      >
        <p className="caption">받은 링크를 붙여넣거나 6자리 방 코드를 입력해 주세요.</p>
        <input
          className="input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setJoinError(null);
          }}
          placeholder="링크 또는 코드(예: 7K3MPQ)"
          aria-label="링크 또는 방 코드"
          autoFocus
        />
        {joinError && <p className="caption caption--warn">{joinError}</p>}
        {!remoteConfigured() && <p className="caption">지금은 공유 방 서버가 연결되지 않아 한 기기 모드만 쓸 수 있어요.</p>}
      </Sheet>
    </div>
  );
}
