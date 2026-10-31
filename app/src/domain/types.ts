// 도메인 엔진 입력·출력 타입. 순수 TS — DOM·SDK 의존 금지.
import type { Candidate, Preference } from '@jeomsimhabui/room-core';

export type { Candidate, Preference };

/** 공공데이터 음식점(정적 타일 /v1/tiles/{i}_{j}.json의 한 행을 푼 것). */
export interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  tags: string[];
  tagSource: 'source' | 'estimated';
  baseDate: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** 내 위치 기준으로 거리를 붙인 주변 음식점. */
export interface NearbyPlace {
  place: Place;
  distanceM: number;
  walkMin: number;
}

/**
 * 그룹 조건 요약. 서버(get_room_state)와 한 기기 모드(aggregatePreferences)가 같은 모양을 만든다.
 * 개인 값은 담지 않는다.
 */
export interface GroupConstraints {
  participantCount: number;
  readyCount: number;
  /** 각자 예산 상한의 최솟값. 아무도 정하지 않으면 null. */
  budgetCap: number | null;
  /** 각자 걷기 한도의 최솟값(분). */
  walkCap: number | null;
  /** 못 먹는 것 합집합. */
  cannotEat: string[];
  /** 태그별 원한 사람 수. */
  likeCounts: Record<string, number>;
  /** 태그별 가중치 합(참가자마다 likes 합이 1이 되게 정규화). */
  likeWeights: Record<string, number>;
}

export type BlockReason = 'cannotEat' | 'budget' | 'distance';

export interface Evaluated {
  candidate: Candidate;
  walkMin: number | null;
  /** 못 먹는 것 칩이 있고, 이 후보 종류에 해당 메뉴가 있을 수 있음. */
  needsMenuCheck: boolean;
  priceKnown: boolean;
}

export interface FilterResult {
  passed: Evaluated[];
  /** 그룹 수준으로만 보여 줄 '막힌 이유'별 후보 수. 누가 막았는지는 담지 않는다. */
  blocked: Record<BlockReason, number>;
}

export interface Recommendation extends Evaluated {
  /** 정렬용 내부 점수(화면 노출 금지). */
  score: number;
  reasons: string[];
}
