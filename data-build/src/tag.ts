// 업태 → 앱 음식 종류 태그(app/src/domain/lunch-policy.ts FOOD_TAGS의 id).
// 업태 값 목록은 Phase 0에서 실데이터(report.ts businessTypes)로 확인해 이 표를 맞춘다.
// 업태가 없거나 '기타'면 사업장명 규칙으로 추정하고 tagSource='estimated'로 표시한다.

const BY_BUSINESS_TYPE: Record<string, string> = {
  한식: 'korean',
  중국식: 'chinese',
  일식: 'japanese',
  경양식: 'western',
  외국음식전문점: 'asian',
  분식: 'snack',
  김밥: 'snack',
  '김밥(도시락)': 'snack',
  횟집: 'seafood',
  '식육(숯불구이)': 'meat',
  '탕류(보신용)': 'soup',
  냉면집: 'noodle',
  패스트푸드: 'fastfood',
  까페: 'cafe',
  카페: 'cafe',
  커피숍: 'cafe',
  제과점영업: 'cafe',
};

// 이름 규칙(추정) — 앞에서부터 먼저 맞는 것
const BY_NAME: [RegExp, string][] = [
  [/국밥|해장|설렁탕|곰탕|찌개|감자탕|순대국/, 'soup'],
  [/국수|칼국수|냉면|우동|라멘|소바|쌀국수/, 'noodle'],
  [/횟집|수산|해물|회센터|아구|조개/, 'seafood'],
  [/고기|갈비|삼겹|정육|숯불|곱창|족발|보쌈/, 'meat'],
  [/초밥|스시|돈가스|돈까스|카츠|이자카야/, 'japanese'],
  [/반점|짜장|짬뽕|마라|중화/, 'chinese'],
  [/파스타|피자|버거|스테이크|브런치/, 'western'],
  [/김밥|떡볶이|분식/, 'snack'],
  [/카페|커피|베이커리|제과/, 'cafe'],
  [/쌀국수|타이|베트남|인도|커리/, 'asian'],
];

export function tagFor(businessType: string | undefined, name: string): { tags: string[]; tagSource: 'source' | 'estimated' } {
  const t = businessType?.trim();
  if (t && BY_BUSINESS_TYPE[t]) return { tags: [BY_BUSINESS_TYPE[t]], tagSource: 'source' };
  for (const [re, tag] of BY_NAME) if (re.test(name)) return { tags: [tag], tagSource: 'estimated' };
  return { tags: [], tagSource: 'estimated' };
}
