# data-build/raw — 공공데이터 원본 (수정 금지)

원본은 git에 넣지 않는다(`.gitignore`). 이름에 데이터셋 번호와 **기준일**을 넣는다. 커밋하는 것은 산출물(`fixtures/station-coords.json`, `fixtures/station-regions.json`)뿐.

| 위치 | 데이터 | 받는 방법 |
|---|---|---|
| `15093755_전체_도시철도역사정보_YYYYMMDD.xlsx` | 국가철도공단 도시광역철도 역사정보(역위도·역경도, WGS84) | 철도데이터포털 `https://data.kric.go.kr/rips/dataset/download.file?type=filedata&id=32&operation=1` (로그인 불필요, data.go.kr 15093755의 '바로가기') → `npm run data:stations` |
| `15154916_일반음식점_YYYYMMDD/<시도_시군구>.ndjson` | 행정안전부_식품_일반음식점 조회서비스(API) | `DATA_GO_KR_KEY=… npm run data:fetch -- --probe` → `--open-code <코드> [--focus]` |

- 2026-10-31 확인: 예전 파일 링크(LOCALDATA `file.localdata.go.kr`)는 2026-04-16 서비스 종료로 403. 음식점 원본은 API(15154916)만 있다.
- 서비스 키는 `data-build/.env`(git 제외) 또는 환경변수 `DATA_GO_KR_KEY`. 포털 '일반 인증키(Decoding)' 값을 넣는다.
- API 응답의 전화번호·종사자 수 등은 저장하지 않는다(`column-map.ts` `KEEP_FIELDS`만).
