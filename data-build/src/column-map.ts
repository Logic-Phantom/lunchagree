// 원본 컬럼 이름은 여기 한 곳에서만 정한다.
// ⚠ Phase 0 미확인: 아래 이름은 지방행정 인허가(LOCALDATA) 일반음식점 파일에서 흔히 쓰던 표기다.
//   2026-01 공공데이터포털 통합 후 실제 파일·API 응답의 컬럼명을 내려받아 확인하고, 다르면 여기만 고친다.
//   validate.ts가 필수 컬럼이 없으면 빌드를 멈추므로 틀린 이름으로 조용히 빈 결과가 나오지 않는다.
export const COLUMNS = {
  id: '관리번호',
  name: '사업장명',
  status: '영업상태명',
  address: '소재지전체주소',
  roadAddress: '도로명전체주소',
  x: '좌표정보(x)', // EPSG:5174(중부원점 Bessel) — 프롬프트 §3-1
  y: '좌표정보(y)',
  businessType: '업태구분명', // 음식 종류 태그 원천(없으면 사업장명 규칙으로 추정)
} as const;

export const REQUIRED: (keyof typeof COLUMNS)[] = ['id', 'name', 'status', 'x', 'y'];

/** '영업' 상태로 볼 값. Phase 0에서 실제 값 목록(report.ts statusValues)을 보고 확정한다. */
export const OPEN_STATUS_VALUES = ['영업/정상', '영업'];
