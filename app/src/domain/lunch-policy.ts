// 추천 규칙의 모든 상수는 여기 한 곳에서 관리한다(프롬프트 §4·§6). 화면·엔진에서 숫자를 직접 쓰지 않는다.

/** 직선거리 → 실제 걷는 거리 보정 계수(도로 우회). 추정치. */
export const WALK_DETOUR_FACTOR = 1.3;
/** 분당 보행 거리(m). 추정치. */
export const WALK_METERS_PER_MIN = 75;
/** 결과에 보여 줄 추천 후보 수. */
export const MAX_RECOMMENDATIONS = 3;
/** 공공데이터 후보를 찾는 기준점 반경(m) — data-build 샤드 반경과 같다. */
export const PLACE_RADIUS_M = 1000;
/** 지도에 그리는 최대 핀 수(가까운 순). 도심은 반경 1km에 2,500곳이 넘어 다 그리면 누를 수 없다. */
export const MAP_MAX_PINS = 100;
/** 지도 반경·거리 링(m). */
export const MAP_RING_STEPS_M: readonly number[] = [250, 500, 1000];
/** 후보 추가 시트의 주변 목록 최대 행 수. 나머지는 검색으로 찾는다. */
export const NEARBY_LIST_MAX = 60;
/** 주변 추천을 한 번에 보여 주는 수. */
export const SUGGEST_PAGE_SIZE = 5;
/** 아무도 고르지 않은 종류를 한 번에 보여 주는 최대 수(가까운 곳이 한 종류로 몰리지 않게). */
export const SUGGEST_PER_TAG_MAX = 2;
/** 누군가 원했을 때만 주변 추천에 넣는 종류(점심 식사 후보가 아닌 곳). */
export const SUGGEST_SKIP_TAGS_UNLESS_LIKED: readonly string[] = ['cafe'];

/** 점수 가중치(합 1). 점수 숫자는 화면에 노출하지 않는다. */
export const SCORE_WEIGHTS = { like: 0.7, distance: 0.3 } as const;
/** 걷기 한도를 아무도 정하지 않았을 때 거리 가점 기준(분). */
export const DEFAULT_WALK_SCALE_MIN = 15;

export const BUDGET_OPTIONS: readonly { value: number | null; label: string }[] = [
  { value: 8000, label: '8천원 이하' },
  { value: 10000, label: '1만원 이하' },
  { value: 12000, label: '1만 2천원 이하' },
  { value: 15000, label: '1만 5천원 이하' },
  { value: 20000, label: '2만원 이하' },
  { value: null, label: '상관없음' },
];

export const WALK_OPTIONS: readonly { value: number | null; label: string }[] = [
  { value: 5, label: '5분 이내' },
  { value: 10, label: '10분 이내' },
  { value: 15, label: '15분 이내' },
  { value: 20, label: '20분 이내' },
  { value: null, label: '상관없음' },
];

/** 음식 종류 태그(공공데이터 업태 → data-build/src/tag.ts에서 이 값으로 매핑). */
export const FOOD_TAGS = [
  { id: 'korean', label: '한식' },
  { id: 'soup', label: '국밥·찌개' },
  { id: 'noodle', label: '면·국수' },
  { id: 'chinese', label: '중식' },
  { id: 'japanese', label: '일식' },
  { id: 'seafood', label: '회·해산물' },
  { id: 'meat', label: '고기·구이' },
  { id: 'western', label: '양식' },
  { id: 'snack', label: '분식' },
  { id: 'fastfood', label: '패스트푸드' },
  { id: 'asian', label: '아시안' },
  { id: 'cafe', label: '카페·베이커리' },
] as const;

export type FoodTagId = (typeof FOOD_TAGS)[number]['id'];

export function tagLabel(id: string): string {
  return FOOD_TAGS.find((t) => t.id === id)?.label ?? '기타';
}

/**
 * '못 먹는 것' 고정 칩. 이유(알레르기·종교·건강)는 묻지도 저장하지도 않는다.
 * exclude: 이 종류는 메뉴 대부분이 해당 → 후보에서 뺀다(하드 조건).
 * check: 해당 메뉴가 있을 수 있음 → 남기되 "메뉴 확인 필요" 표시. 공공데이터에 메뉴가 없어 안전을 보증할 수 없다.
 */
export const CANNOT_EAT = [
  { id: 'seafood', label: '해산물', exclude: ['seafood'], check: ['japanese', 'korean', 'soup', 'noodle', 'chinese', 'asian', 'snack'] },
  { id: 'raw', label: '날것(회)', exclude: ['seafood'], check: ['japanese'] },
  { id: 'pork', label: '돼지고기', exclude: [], check: ['meat', 'korean', 'soup', 'chinese', 'snack', 'noodle', 'asian', 'western', 'fastfood'] },
  { id: 'beef', label: '소고기', exclude: [], check: ['meat', 'korean', 'soup', 'western', 'fastfood', 'noodle', 'asian'] },
  { id: 'chicken', label: '닭고기', exclude: [], check: ['meat', 'korean', 'soup', 'fastfood', 'western', 'asian', 'snack'] },
  { id: 'spicy', label: '매운 음식', exclude: [], check: ['korean', 'soup', 'chinese', 'snack', 'asian', 'noodle'] },
  { id: 'nuts', label: '견과류', exclude: [], check: ['cafe', 'asian', 'western', 'chinese'] },
  { id: 'dairy', label: '유제품', exclude: [], check: ['cafe', 'western', 'fastfood'] },
  { id: 'wheat', label: '밀가루', exclude: [], check: ['noodle', 'western', 'fastfood', 'snack', 'cafe', 'chinese', 'japanese'] },
] as const satisfies readonly { id: string; label: string; exclude: readonly string[]; check: readonly string[] }[];

export type CannotEatId = (typeof CANNOT_EAT)[number]['id'];

export function cannotEatLabel(id: string): string {
  return CANNOT_EAT.find((c) => c.id === id)?.label ?? id;
}

/** 고지문(프롬프트 §7-8). 후보·결과 화면 하단에 그대로 쓴다. */
export const PLACE_DISCLAIMER =
  '인허가 정보 기준이라 실제 상호·영업 여부·메뉴·가격과 다를 수 있어요. 거리와 시간은 직선거리 기반 추정이에요.';
export const MENU_CHECK_NOTICE = '못 먹는 음식이 들어가는지는 가게에서 꼭 확인해 주세요. 점심합의는 알레르기 안전을 보증하지 않아요.';
