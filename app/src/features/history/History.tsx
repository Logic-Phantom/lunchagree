// 결정 기록(기기 로컬). "최근 우리 팀이 간 곳"을 다시 볼 수 있게.
import { useEffect, useState } from 'react';
import { FoodThumb } from '../../components/FoodThumb';
import { Button, Header, Screen } from '../../components/ui';
import { tagLabel } from '../../domain';
import { clearDecisions, listDecisions, type DecisionRecord } from '../../storage/records';

export function History() {
  const [list, setList] = useState<DecisionRecord[]>([]);
  useEffect(() => {
    listDecisions().then(setList);
  }, []);

  return (
    <Screen>
      <Header title="최근 이용 기록" />
      {list.length === 0 ? (
        <p className="empty">아직 결정한 점심이 없어요.</p>
      ) : (
        <ul className="card-list">
          {list.map((h) => (
            <li key={h.roomId} className="list-card">
              <FoodThumb tags={h.tags} size={44} />
              <span className="list-card__text">
                <strong>{h.placeName}</strong>
                <small>
                  {h.tags.map(tagLabel).join('·') || '종류 미확인'} · {h.roomTitle} · {h.decidedAt.slice(0, 10).replace(/-/g, '.')}
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}
      {list.length > 0 && (
        <Button
          variant="text"
          onClick={async () => {
            await clearDecisions();
            setList([]);
          }}
        >
          기록 모두 지우기
        </Button>
      )}
      <p className="caption">기록은 이 기기에만 저장돼요.</p>
    </Screen>
  );
}
