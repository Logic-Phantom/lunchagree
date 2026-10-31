# 결정 기록 (DECISIONS)

근거 확인일은 2026-10-31(별도 표기 제외). "확인"은 설치된 패키지 타입·실행 결과로 본 것, "미확인"은 Phase 0·출시 전에 다시 볼 것.

| ID | 결정 | 근거·확인 |
|---|---|---|
| D-001 | **Vite 8 + React 19 + TypeScript 7 + `@apps-in-toss/web-framework` 3.9.0**, CSR 전용. npm workspaces로 `app/`·`data-build/`·`packages/room-core/` 분리 | 사잇 D-001과 같은 스택(사잇은 같은 버전으로 2026-10-30 출시·검토 통과). 앱인토스 WebView는 CSR/SSG만 |
| D-002 | `apps-in-toss.config.ts`는 설치된 `dist/config.d.ts` 타입대로 직접 작성: `appName`, `brand.primaryColor`, `permissions`, `navigationBar`, `webView`, `webBundleDir` | `node_modules/@apps-in-toss/web-framework/dist/config.d.ts`(3.9.0) 확인 |
| D-003 | `appName = 'jeomsimhabui'`(사용자 지정). config·`src/platform/toss.ts` `APP_NAME`·package.json name·딥링크에 같은 값 | 프롬프트 §2. **콘솔에서 사용 가능 여부 미확인** — 이미 쓰이면 사용자에게 보고(임의 변경 금지) |
| D-004 | 토스 앱 판별 = `window.ReactNativeWebView != null`. 밖에서는 SDK를 부르지 않고 브라우저 대체(localStorage, navigator.share/clipboard, 해시 링크) | 사잇 D-004(3.9.0 dist 확인). 공개 API가 아니므로 SDK 업데이트 때 재확인 |
| D-005 | 자체 뒤로가기는 **토스 밖에서만** 그린다(`Header`). 공유 화면의 닫기(X)는 예외적으로 항상 표시 | 토스 내비게이션 바와 뒤로가기 중복 금지. X는 화면 닫기 동작이라 뒤로가기와 겹치지 않음 → **검토 시 지적되면 제거** |
| D-006 | 사용자 식별 = `User.getAnonymousKey()`의 `hash`(3.9.0 타입: `{ type: 'HASH', hash }`, 미지원 버전 throw). 서버에는 `SHA-256(방키:익명키)`만 보낸다. 미지원·브라우저는 기기 로컬 랜덤 UUID | `dist/index.d.ts` `User.getAnonymousKey` 확인(구 `getAnonymousKey`는 deprecated). 토스 로그인은 사업자 필요 → 미사용 |
| D-007 | **후보 데이터 = 공공데이터 '일반음식점' 정적 샤드**(GitHub Pages `/v1/near/{역ID}.json`, 반경 1km). 카카오·네이버 API는 MVP 미사용 | 프롬프트 §1·§3-1: 카카오 로컬은 응답 원본·가공 데이터 저장 불가(방에 후보 저장 구조와 충돌), 네이버는 조건 미확인. 공공데이터는 이용허락 제한 없음 |
| D-008 | **샤드가 없으면(데이터 빌드 전) 후보는 '직접 추가'만**. 데모·가짜 식당을 넣지 않는다 | 프롬프트 §0-4. 사잇의 '데모 데이터 배너' 방식도 쓰지 않음 — 식당은 실재 여부가 중요 |
| D-009 | 해시 라우팅(`createHashRouter`). 토스 진입 시 `Environment.initialURL`이 `intoss(-private)://<앱>/room?t=…`이면 `/join?t=`로, 검증 실패 시 홈 | 사잇 D-009. **initialURL 쿼리 파싱은 토스앱 실기기 미확인** |
| D-010 | 방 링크 = `Share.createLink({ path: 'intoss://jeomsimhabui/room?t=<토큰>' })` → `Share.sendMessage`. 링크엔 토큰만(닉네임·조건 금지) | 3.9.0 타입 `Share.createLink`/`sendMessage` 확인. 출시 전 테스트는 `intoss-private://` |
| D-011 | **두 가지 방 모드**: `remote`(Supabase, 환경변수 있을 때) / `local`(한 기기 모드 — 방장 폰으로 참가자를 추가해 돌려 가며 입력, 서버 전송 없음) | Supabase 프로젝트·키가 아직 없음(사용자 할 일). 서버 없이도 전체 흐름(조건→후보→투표→결과)을 쓸 수 있고, Free 일시중지 때 대체 수단 |
| D-012 | 실시간 반영 = **5초 폴링**(화면이 보일 때만). Supabase Realtime은 쓰지 않음 | Realtime은 테이블 RLS 정책(SELECT 허용)이 필요한데 이 스키마는 테이블 정책이 0개(RPC 전용)라 개인 조건 노출 위험. 2~6명·짧은 방이라 폴링 요청 수가 Free 한도 대비 작음 |
| D-013 | Supabase 접근은 **supabase-js 없이 PostgREST `/rest/v1/rpc/<함수>` 직접 호출** | 런타임 의존성·번들 축소. 쓰는 기능이 RPC뿐 |
| D-014 | 온보딩 06의 '카카오톡으로 공유하기' → **'메시지로 공유하기'(토스 공유 시트)** | 외부 앱 직접 연동·이동 허용 여부 미확인(프롬프트 §3-2). `Share.sendMessage`가 카카오톡 등 시스템 공유 대상 포함 |
| D-015 | 온보딩 03~06의 **별점·가격·음식 사진은 쓰지 않는다** → "종류 · 약 N분(추정) · 가격 미확인/직접 입력" + 자체 음식 종류 그림(`FoodThumb`) | 평점·가격·사진 데이터 없음(프롬프트 §2 하지 않는 것, §7-3 식당 사진 금지) |
| D-016 | 온보딩 05의 '멤버별 이동 정보(18분·1회 환승)' → **'멤버별 참여 정보(조건 입력·투표 여부)'** | 점심합의는 기준역 하나 기준이라 개인별 이동 정보가 없음(사잇 기능과 혼동 방지). 누가 무엇에 투표했는지는 표시하지 않음 |
| D-017 | 앱 아이콘·로고·파비콘·OG·콘솔 로고는 **사용자 제공 아이콘 원본에서 잘라 냄**(`scripts/build-app-icons.py`). 테두리 검출은 회색 테두리 선(밝기 ≤245)을 스캔 | 원본은 흰 캔버스 + 넓은 그림자라 floodfill로는 그림자까지 잡힘(실측). 콘솔 로고는 600×600 흰 배경·둥글림 없음(사잇 D-016 근거) |
| D-018 | 디자인 = 온보딩 가이드: 흰 바탕 · 남색(#23252D) 필 버튼 · 외곽선 필 · 연회색 패널 · 아이콘 노란색(#F6BD45) 포인트 · 아바타(남색·주황·분홍·회색) | `docs/design/onboarding-guide.png`. 색은 `design-tokens.css`에만 |
| D-019 | 도보 시간 = 직선거리 × 1.3 ÷ 75m/분, 올림, 항상 "(추정)" | 프롬프트 §4. 계수는 `lunch-policy.ts` 한 곳 |
| D-020 | 점수 = 0.7 × 좋아요(참가자당 합 1 정규화, 후보 태그 중 최댓값 ÷ 입력 인원) + 0.3 × 거리(1 − 분/걷기한도, 한도 없으면 15분). 정렬 동점 → 도보 분 → 이름 → id | 프롬프트 §6. 점수 숫자는 화면 비노출. 가중치는 초기값 — 사용 데이터로 조정 |
| D-021 | 못 먹는 것 판정 = 칩별 `exclude`(제외 종류)·`check`(메뉴 확인 필요 종류) 표. 종류 미상 후보는 칩이 하나라도 있으면 확인 필요 | 공공데이터에 메뉴 없음(프롬프트 §6). 안전 보증 문구 금지 |
| D-022 | 서버 RPC 인증: 참여는 토큰(서버에서 SHA-256 비교) 또는 6자리 코드(시간당 10회), 이후 호출은 (room_id, participant_id, participant_secret). secret 원문은 기기에만 | 코드로 들어온 사람은 토큰 원문이 없으므로 방 ID 기반으로 통일. 방장만 토큰을 기기에 보관(초대 링크 재생성) |
| D-023 | 그룹 요약을 **서버 SQL(get_room_state)과 TS(aggregatePreferences)가 같은 규칙으로** 각각 계산 | 서버는 개인 조건을 내보내지 않아야 하고, 한 기기 모드는 서버가 없음. 두 구현의 일치는 rls_test.sql(예산 최솟값·합집합·좋아요 수)과 domain.test.ts로 확인 |
| D-024 | SQL 검증 = **PGlite(WASM Postgres)** 로 마이그레이션 + `rls_test.sql` 실행(`npm run test:sql`, CI 포함) | Docker·psql·Supabase CLI가 없는 환경에서도 실제 Postgres로 실행. anon 역할·기본 테이블 권한만 흉내 → Supabase 실프로젝트에서 한 번 더 확인 필요 |
| D-025 | 방 만료 = 당일 23:59 KST 또는 12시간 중 이른 시각(TS·SQL 동일), 정리는 `purge_expired_rooms()`를 pg_cron 하루 1회 | 프롬프트 §4. pg_cron 등록은 Supabase 프로젝트 생성 후 사용자 확인 |
| D-026 | 공공데이터 원본 컬럼명은 `data-build/src/column-map.ts` 한 곳, **현재 값은 LOCALDATA 시절 표기(미확인)**. 필수 컬럼이 없으면 빌드 실패 | 2026-01 포털 통합 후 컬럼명 변경 가능성 — Phase 0 `npm run data:report`로 확인 |
| D-027 | EPSG:5174 → WGS84는 proj4(MIT) + `towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43` | 국내에서 널리 쓰는 Bessel→WGS84 7변수. **실주소 3곳 대조(오차 ≤30m)는 Phase 0** |
| D-028 | 역 ID·이름은 사잇 `graph.v1.json`(역 581개)에서 **복사**(`data-build/fixtures/stations-saeit.json`, `app/src/data/stations.v1.json`). 좌표는 없음 → Phase 0에서 좌표 출처 결정 | 프롬프트 §10 '같은 역 ID 체계', 저장소 간 import 금지 |
| D-029 | `room-core`는 점심합의에서 먼저 만들었다. 사잇 Phase 5에서 쓸 때 **복사**한다 | 프롬프트 §4·§12-3. 사용자에게 순서 확인 필요(README 다음 할 일) |
| D-030 | 인앱 광고(Phase 4)는 `ads/ResultBanner.tsx` 자리만, `ADS_ENABLED=false` | WebView 배너 API·테스트 광고 ID 미확인(추측 금지) |
