# 테스트

```bash
npm test            # room-core 13 + data-build 8 + app 11 = 32
npm run typecheck   # 세 워크스페이스
npm run test:sql    # Supabase 마이그레이션 + RLS 테스트 (PGlite)
npm run build       # 라이선스 감사 + tsc + vite build
```

## 자동 테스트 범위
| 파일 | 내용 |
|---|---|
| `packages/room-core/tests/room-core.test.ts` | 토큰·해시·짧은 코드, 만료(오전/오후/자정 이후), 닉네임, 인원, 상태 전이, 투표 집계·동률, 링크 토큰 추출 |
| `app/tests/domain.test.ts` | Haversine·도보 추정, 그룹 조건(최솟값·합집합·정규화), 하드 조건 필터·막힌 이유, 미확인 값 처리, 메뉴 확인 필요, 추천 정렬·이유 문장(점수 비노출), **가짜 후보를 만들지 않음**, 동점 결정성, 득표 결과 |
| `data-build/tests/data-build.test.ts` | CSV 파서, EPSG:5174 변환·이상 좌표, 종류 태그(원천/추정), 영업 필터·통계, 1km 샤드, 필수 컬럼, Phase 0 게이트 |
| `packages/room-core/supabase/tests/rls_test.sql` | anon 테이블 직접 읽기·쓰기 차단, 참여·조건 저장, 잘못된 secret 거부, 그룹 요약 값, 개인 예산 비노출, 방장 전용 상태 변경, 중복 참여 방지, 내부 함수 차단 |

`rls_test.sql`은 일부러 값을 틀리게 바꾸면 실패하는 것을 확인했다(2026-10-31).

## 수동 확인 (브라우저, 2026-10-31)
- 개발 서버 375×812: 홈 → 방 만들기(참가자 4명·강남역·조건) → 후보 추가 → 추천(해산물 제외·예산 초과 제외 반영) → 투표(한 기기 모드 3표) → 결과 → 공유. 콘솔 오류 0.
- 360px 폭: 7개 화면 가로 스크롤 없음.

## 아직 못 한 것
- Supabase 실제 프로젝트에서 마이그레이션·RPC·PostgREST 호출(`remoteRepo`) — 프로젝트 생성 후.
- 토스앱 샌드박스·QR(`intoss-private://`) 두 기기 참여·투표 E2E.
- 후보 표시 2초 이내 실기기 측정(샤드 배포 후).
