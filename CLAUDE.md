# 점심합의 작업 규칙 (요약)

원본 기획: `docs/SUPER_PROMPT.md`. 사잇(`C:\eclipse_AI\saeit`) 규칙을 그대로 따른다.

- 판단 순서: 무료 한도 > 데이터 약관·개인정보 > 정확성 > 기능 > 디자인.
- 앱인토스 API는 추측하지 않는다: `https://developers-apps-in-toss.toss.im/llms.txt` 문서와 설치된 `node_modules/@apps-in-toss/web-framework/dist/*.d.ts`로 확인하고 `docs/DECISIONS.md`에 근거를 남긴다.
- **없는 식당·가격·영업 상태·도보 시간·평점을 만들지 않는다.** 후보가 부족하면 부족하다고 표시한다. 테스트 데이터는 테스트 파일 안에만.
- 카카오·네이버 장소 API 응답을 저장하지 않는다(MVP 미사용). 후보 기본 데이터는 공공데이터 정적 샤드(`data-build/`).
- 못 먹는 것은 고정 칩 id만, 이유(알레르기·종교·건강)는 받지 않는다. 다른 참가자에게는 그룹 요약만 보인다. 알레르기 안전 보증 문구 금지.
- `app/src/domain/`·`packages/room-core/src/`는 순수 TS(DOM·SDK 의존 금지). 추천 상수는 `app/src/domain/lunch-policy.ts` 한 곳.
- 서버 쓰기는 Supabase RPC만(테이블 정책 없음). 스키마를 바꾸면 `packages/room-core/supabase/tests/rls_test.sql`도 고치고 `npm run test:sql`.
- `data-build/raw/` 원본 수정 금지. 원본 필드명은 `data-build/src/column-map.ts` 한 곳. `fixtures/station-*.json`은 `npm run data:stations` 산출물로만 바꾼다. 서비스 키는 `data-build/.env`(git 제외)·GitHub Secret만.
- 색·간격은 `app/src/styles/design-tokens.css` 토큰만. 디자인 기준은 `docs/design/onboarding-guide.png`, 아이콘은 `assets/brand/icon-source.png`에서 `npm run icons`로만 만든다.
- 상태는 `구현` / `자동 테스트 통과` / `샌드박스 확인` / `토스앱 확인`으로 구분해 README 상태표에 기록. 확인하지 않은 것을 완료로 보고하지 않는다.
- 결정은 `docs/DECISIONS.md`, 작업 내역은 README 맨 아래 Work Log에 마지막으로 갱신.
- 커밋·푸시·콘솔 업로드·출시 요청은 사용자 승인 후에만.
- 검사: `npm test`, `npm run typecheck`, `npm run test:sql`, `npm run build`.
