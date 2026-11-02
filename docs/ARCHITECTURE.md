# 아키텍처

```
[데이터 빌드 — GitHub Actions 주 1회 + 수동 (.github/workflows/data-build.yml)]
 data-build/ (Node 24, TS 타입 제거 실행)
   data.go.kr API 15154916 ─ fetch-api.ts(전국 17개 시·도 × 영업 코드, 쪽 단위 이어받기) → raw/15154916_일반음식점_YYYYMMDD/*.ndjson
     └ verify-crs.ts(EPSG:5174 vs 2097 실측 판정) ─ transform.ts(영업 필터 · reproject.ts · tag.ts)
     └ build.ts(격자 타일 0.005° — app/src/domain/tiles.ts 공용) ─ validate.ts(필수 필드 · 측정 지점 10곳 게이트)
   → out/v1/meta.json, out/v1/tiles/{i}_{j}.json  → GitHub Pages (실패 시 이전 산출물 유지)
   (개발용) raw/15093755_역사정보.xlsx ─ xlsx.ts ─ reference-points.ts → fixtures/reference-points.json(좌표계 판정·측정 지점)

[미니앱 — app/ (Vite + React + TS + @apps-in-toss/web-framework 3.9.0, CSR · 해시 라우팅)]
  domain/      순수 TS: lunch-policy(상수) · group-constraints · distance · tiles · candidate-filter · scoring · explanations · voting · external-map · nearby(주변 추천·지도 핀 선별)
  data/        places-api(내 위치 반경 타일 병렬 fetch·1.8초 타임아웃·캐시) · room-repo(local | remote RPC)
  features/    home · room-create · preferences · candidates · vote · result · share · join · history · settings · room(useRoom 훅)
               location(useMyLocation · NearbyMap 자체 SVG 지도 · PlaceDetailSheet 카카오맵/네이버지도 링크)
  platform/    toss.ts — SDK 감싸기(Share·Clipboard·Environment·User·Device.getLocation·Device.openURL), 토스 밖 대체 동작
  storage/     kv.ts(Storage | localStorage) · records.ts(최근 방·결정 기록·내 기본 조건)
  ads/         결과 화면 배너 자리(Phase 4)
  routes/      router.tsx(해시 라우터) · entry.ts(intoss:// 진입 링크 검증)

[공유 방 — packages/room-core/ + Supabase Free]
  src/         types · token(128bit·SHA-256·6자리 코드) · expiry(23:59 KST/12h) · participant(닉네임·인원·상태 전이) · voting · link
  supabase/migrations/  rooms · participants · preferences · candidates · votes · join_code_attempts · lunch_settings
                        RLS 켜고 정책 0개 → security definer RPC만: create_room · join_room · join_room_by_code ·
                        save_preference · add_candidate · cast_vote · set_room_status · get_room_state(그룹 요약만)
  supabase/tests/rls_test.sql  → scripts/run-sql-tests.ts(PGlite)로 CI에서 실행
```

## 화면 흐름 (온보딩 가이드 01~06)

| 온보딩 | 경로 | 파일 |
|---|---|---|
| 01 방 만들기 | `/` | `features/home/Home.tsx` |
| 02 참가자 & 조건 입력 | `/create`, `/room/:id/pref/:pid` | `features/room-create/RoomCreate.tsx`, `features/preferences/*` |
| 03 식당 후보 추천 | `/room/:id` | `features/candidates/*` |
| 04 투표하기 | `/room/:id/vote` | `features/vote/Vote.tsx` |
| 05 결과 확인 | `/room/:id/result` | `features/result/Result.tsx` |
| 06 공유 & 기록 | `/room/:id/share`, `/history` | `features/share/ShareScreen.tsx`, `features/history/History.tsx` |
| (참여) | `/join?t=` · `/join?code=` | `features/join/Join.tsx` |
| (설정) | `/settings`, `/settings/:page` | `features/settings/Settings.tsx` |

## 방 상태

`COLLECTING`(조건·후보 모으기) → `VOTING`(추천 상위 3곳 투표) → `DECIDED`(결정) → `CLOSED`
- 동률: `VOTING`에 머물고 결과 화면에서 방장이 고르거나 `COLLECTING→VOTING`으로 재투표(표 초기화).
- 참가자 화면은 상태에 따라 자동 이동(후보 → 투표 → 결과).

## 참고한 기존 프로젝트

| 가져온 것 | 출처 |
|---|---|
| 토스 SDK 감싸기·저장소 어댑터·해시 라우팅·진입 링크·아이콘 스크립트·라이선스 스크립트 | `saeit/app/src/platform/toss.ts`, `storage/kv.ts`, `App.tsx`, `scripts/*` |
| Supabase RLS·security definer·fail-closed 설정 테이블·SQL 테스트 형식 | `Cutpick/supabase/migrations/*`, `Cutpick/supabase/tests/rls_test.sql` |
| 오픈소스 라이선스 감사 | `Cutpick/scripts/generate-oss-licenses.mjs` → 사잇 → 점심합의 |
| 예약 실행 Actions(cron + 수동, 정각 회피, concurrency) | `StrangeRecords/.github/workflows/daily-shorts.yml` |
| 역 ID·이름 | `saeit/app/src/data/graph.v1.json` |
