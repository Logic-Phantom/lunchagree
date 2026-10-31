import { useEffect } from 'react';
import { createHashRouter, Outlet, useNavigate } from 'react-router-dom';
import { Candidates } from '../features/candidates/Candidates';
import { History } from '../features/history/History';
import { Home } from '../features/home/Home';
import { Join } from '../features/join/Join';
import { PreferenceScreen } from '../features/preferences/PreferenceScreen';
import { Result } from '../features/result/Result';
import { RoomCreate } from '../features/room-create/RoomCreate';
import { Settings, SettingsPage } from '../features/settings/Settings';
import { ShareScreen } from '../features/share/ShareScreen';
import { Vote } from '../features/vote/Vote';
import { initialSchemeUrl } from '../platform/toss';
import { entryTarget } from './entry';

/** 토스 링크로 들어오면 한 번만 참여 화면으로 보낸다. */
function EntryRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    let done = false;
    initialSchemeUrl().then((url) => {
      if (done || !url) return;
      const target = entryTarget(url);
      if (target) navigate(target, { replace: true });
    });
    return () => {
      done = true;
    };
  }, [navigate]);
  return <Outlet />;
}

// 해시 라우팅: 앱인토스는 dist 정적 파일을 그대로 열기 때문에 서버 경로 재작성에 기대지 않는다(사잇 D-009)
// 흐름: 홈 → 방 만들기 → (공유) → 내 조건 → 후보 → 투표 → 결과 → 공유
export const router = createHashRouter([
  {
    element: <EntryRedirect />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/create', element: <RoomCreate /> },
      { path: '/join', element: <Join /> },
      { path: '/room/:id', element: <Candidates /> },
      { path: '/room/:id/pref/:pid', element: <PreferenceScreen /> },
      { path: '/room/:id/vote', element: <Vote /> },
      { path: '/room/:id/result', element: <Result /> },
      { path: '/room/:id/share', element: <ShareScreen /> },
      { path: '/history', element: <History /> },
      { path: '/settings', element: <Settings /> },
      { path: '/settings/:page', element: <SettingsPage /> },
      { path: '*', element: <Home /> },
    ],
  },
]);
