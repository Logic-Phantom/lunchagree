// 온보딩 03 추천 결과 카드: 썸네일 · 이름 · 한 줄 정보 · 화살표.
// 시안의 별점·가격은 없는 정보라 쓰지 않는다 → "종류 · 약 N분(추정) · 가격 미확인".
import { FoodThumb } from '../../components/FoodThumb';
import { Icon } from '../../components/Icon';
import { formatWon, tagLabel, walkLabel, type Evaluated } from '../../domain';

export function metaLine(e: Evaluated): string {
  const kind = e.candidate.tags.length ? e.candidate.tags.map(tagLabel).join('·') : '종류 미확인';
  const price = e.priceKnown ? `${formatWon(e.candidate.priceHint!)}(직접 입력)` : '가격 미확인';
  return [kind, walkLabel(e.walkMin), price].join(' · ');
}

export function PlaceCard({ e, reason, onClick, rank }: { e: Evaluated; reason?: string; onClick?: () => void; rank?: number }) {
  const body = (
    <>
      <FoodThumb tags={e.candidate.tags} />
      <span className="place-card__text">
        <strong>
          {rank != null && <span className="rank">{rank}</span>}
          {e.candidate.name}
        </strong>
        <small>{metaLine(e)}</small>
        {(reason || e.needsMenuCheck) && (
          <span className="place-card__tags">
            {reason && <em>{reason}</em>}
            {e.needsMenuCheck && <span className="badge badge--warn">메뉴 확인 필요</span>}
          </span>
        )}
      </span>
      {onClick && <Icon name="chevron" size={16} className="row__chevron" />}
    </>
  );
  return onClick ? (
    <button type="button" className="place-card" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="place-card">{body}</div>
  );
}
