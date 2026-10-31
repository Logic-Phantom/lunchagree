// 원본 필드 이름은 여기 한 곳에서만 정한다.
// 확인(2026-10-31): 공공데이터포털 '행정안전부_식품_일반음식점 조회서비스'(15154916, 2026-08-25 수정) Swagger 응답 필드.
//   LOCALDATA 파일(15045016의 다운로드 링크)은 2026-04-16 서비스 종료로 403 — 원본은 이 API만 남았다.
//   응답에는 전화번호·종사자 수 등도 있지만 아래 필드만 저장한다(데이터 최소화).
export const API = {
  endpoint: 'https://apis.data.go.kr/1741000/general_restaurants/info',
  maxRows: 100, // numOfRows 최대(문서)
} as const;

export const COLUMNS = {
  id: 'MNG_NO', // 관리번호
  name: 'BPLC_NM', // 사업장명
  statusCode: 'SALS_STTS_CD', // 영업상태코드
  status: 'SALS_STTS_NM', // 영업상태명
  detailStatus: 'DTL_SALS_STTS_NM', // 상세영업상태명
  address: 'LOTNO_ADDR', // 지번주소
  roadAddress: 'ROAD_NM_ADDR', // 도로명주소
  x: 'CRD_INFO_X', // 좌표정보(X) — 문서: "보정계수 안들어간 Bessel 중부원점TM(EPSG:5174)" → verify-crs.ts로 실측 확인
  y: 'CRD_INFO_Y',
  businessType: 'BZSTAT_SE_NM', // 업태구분명(음식 종류 태그 원천)
  sanitationType: 'SNTTN_BZSTAT_NM', // 위생업태명(업태구분명이 비면 대신 사용)
  region: 'OPN_ATMY_GRP_CD', // 개방자치단체코드
  updatedAt: 'DAT_UPDT_PNT', // 데이터갱신시점
} as const;

/** 수집할 때 남기는 필드(나머지는 버린다). */
export const KEEP_FIELDS: string[] = Object.values(COLUMNS);

export const REQUIRED: (keyof typeof COLUMNS)[] = ['id', 'name', 'status', 'x', 'y'];

/** '영업'으로 볼 영업상태명. 확인(2026-10-31 --probe): 코드 01 = '영업/정상'(상세 '영업'), 03 = '폐업'. */
export const OPEN_STATUS_VALUES = ['영업/정상'];
export const OPEN_STATUS_CODE = '01';

/** 점심 장소가 아닌 업태(무점포 출장조리·주점)는 후보에서 뺀다. 실제 값은 --probe로 확인. */
export const EXCLUDED_BUSINESS_TYPES = ['출장조리', '감성주점'];
