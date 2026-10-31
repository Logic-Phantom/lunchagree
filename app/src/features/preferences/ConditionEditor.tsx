// '내 조건 입력하기' — 온보딩 02 화면의 행 목록(예산 · 못 먹는 것 · 걷기 한도) + 좋아하는 종류.
// 행을 누르면 바텀시트로 고른다. 못 먹는 것은 고정 칩만, 이유는 묻지 않는다.
import { useState } from 'react';
import { Button, Chip, Row, Sheet } from '../../components/ui';
import { BUDGET_OPTIONS, CANNOT_EAT, cannotEatLabel, FOOD_TAGS, MENU_CHECK_NOTICE, tagLabel, WALK_OPTIONS } from '../../domain';
import type { DefaultPreference } from '../../storage/records';

export type PreferenceValue = DefaultPreference;

export const EMPTY_PREFERENCE: PreferenceValue = { maxBudget: 10000, likes: [], cannotEat: [], maxWalkMinutes: 10 };

type SheetKind = 'budget' | 'cannotEat' | 'walk' | 'likes' | null;

function listLabel(ids: string[], label: (id: string) => string, empty: string) {
  if (ids.length === 0) return empty;
  if (ids.length <= 2) return ids.map(label).join(', ');
  return `${label(ids[0])} 외 ${ids.length - 1}개`;
}

export function ConditionEditor({ value, onChange }: { value: PreferenceValue; onChange: (v: PreferenceValue) => void }) {
  const [open, setOpen] = useState<SheetKind>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const close = () => setOpen(null);
  const openMulti = (kind: 'cannotEat' | 'likes') => {
    setDraft(kind === 'cannotEat' ? value.cannotEat : value.likes);
    setOpen(kind);
  };
  const toggle = (id: string) => setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  return (
    <>
      <div className="row-list">
        <Row icon="wallet" label="예산" value={BUDGET_OPTIONS.find((o) => o.value === value.maxBudget)?.label ?? '상관없음'} onClick={() => setOpen('budget')} />
        <Row icon="noEat" label="못 먹는 것" value={listLabel(value.cannotEat, cannotEatLabel, '없음')} onClick={() => openMulti('cannotEat')} />
        <Row icon="walk" label="걷기 한도" value={WALK_OPTIONS.find((o) => o.value === value.maxWalkMinutes)?.label ?? '상관없음'} onClick={() => setOpen('walk')} />
        <Row icon="heart" label="먹고 싶은 것" value={listLabel(value.likes, tagLabel, '아무거나')} onClick={() => openMulti('likes')} />
      </div>

      <Sheet open={open === 'budget'} title="예산" onClose={close}>
        <div className="option-list">
          {BUDGET_OPTIONS.map((o) => (
            <button
              key={o.label}
              type="button"
              className={`option${o.value === value.maxBudget ? ' option--on' : ''}`}
              onClick={() => {
                onChange({ ...value, maxBudget: o.value });
                close();
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="caption">가격은 직접 입력한 후보에만 적용돼요. 공공데이터에는 가격 정보가 없어요.</p>
      </Sheet>

      <Sheet open={open === 'walk'} title="걷기 한도" onClose={close}>
        <div className="option-list">
          {WALK_OPTIONS.map((o) => (
            <button
              key={o.label}
              type="button"
              className={`option${o.value === value.maxWalkMinutes ? ' option--on' : ''}`}
              onClick={() => {
                onChange({ ...value, maxWalkMinutes: o.value });
                close();
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="caption">걷는 시간은 직선거리로 계산한 추정치예요.</p>
      </Sheet>

      <Sheet
        open={open === 'cannotEat'}
        title="못 먹는 것"
        onClose={close}
        footer={
          <Button
            onClick={() => {
              onChange({ ...value, cannotEat: draft });
              close();
            }}
          >
            {draft.length ? `${draft.length}개 선택 완료` : '없음으로 저장'}
          </Button>
        }
      >
        <p className="caption">이유는 묻지 않아요. 다른 사람에게는 "해산물 제외"처럼 그룹 결과만 보여요.</p>
        <div className="chips">
          {CANNOT_EAT.map((c) => (
            <Chip key={c.id} selected={draft.includes(c.id)} onClick={() => toggle(c.id)}>
              {c.label}
            </Chip>
          ))}
        </div>
        <p className="caption caption--warn">{MENU_CHECK_NOTICE}</p>
      </Sheet>

      <Sheet
        open={open === 'likes'}
        title="먹고 싶은 것"
        onClose={close}
        footer={
          <Button
            onClick={() => {
              onChange({ ...value, likes: draft });
              close();
            }}
          >
            {draft.length ? `${draft.length}개 선택 완료` : '아무거나'}
          </Button>
        }
      >
        <p className="caption">여러 개 고르면 한 사람의 선호가 나눠서 반영돼요.</p>
        <div className="chips">
          {FOOD_TAGS.map((t) => (
            <Chip key={t.id} selected={draft.includes(t.id)} onClick={() => toggle(t.id)}>
              {t.label}
            </Chip>
          ))}
        </div>
      </Sheet>
    </>
  );
}
