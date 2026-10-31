# data-build/raw — 공공데이터 원본 (수정 금지)

원본은 용량이 커서 git에 넣지 않는다(`.gitignore`). 파일명에 데이터셋 번호와 **기준일**을 넣는다.

| 파일명 규칙 | 데이터 | 받는 곳 |
|---|---|---|
| `15045016_일반음식점_YYYYMMDD.csv` | 행정안전부_식품_일반음식점 (인허가) | https://www.data.go.kr/data/15045016/fileData.do (활용신청·로그인 필요 시 사용자 직접) |

- 서비스 키가 필요한 API 방식은 Phase 0에서 엔드포인트·필드를 공식 문서로 확인한 뒤 `src/fetch.ts`로 추가한다(키는 GitHub Secret `DATA_GO_KR_KEY`, 커밋 금지).
- 받은 뒤 `npm run data:report`로 컬럼·영업상태 값·업태 값·좌표 결측률을 확인하고 `docs/DATA_SOURCES.md`에 기록한다.
