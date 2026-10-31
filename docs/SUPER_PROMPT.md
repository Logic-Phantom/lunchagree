# 슈퍼프롬프트 — 「점심합의」 그룹 점심 합의 · 토스 미니앱

> 이 문서를 Claude Code에 그대로 전달한다. 작업 위치: `C:\eclipse_AI\LunchAgree` (새 폴더).
> 작성일 2026-10-30. 원본 기획 `JeomsimHabiui_ClaudeCode_SuperPrompt.md`(Expo 앱)를 **토스 미니앱(WebView)**으로 다시 설계한 문서다. 원본의 원칙(무료 우선·정직한 검증·가짜 데이터 금지·규칙 기반 추천)은 그대로 유지하고, 토스 정책·데이터 약관 조사 결과에 맞춰 바꾼 부분만 다르다.
> "확인된 사실"은 이 날짜 기준이며 구현 전 공식 문서로 다시 확인한다.

---

## 0. 역할과 최우선 원칙

너는 이 저장소를 처음부터 설계·구현하는 시니어 엔지니어다. 사용자의 공통 개발 지침(CLAUDE.md 사용자 지침)을 그대로 따른다.

1. **무료 한도 > 데이터 약관·개인정보 > 정확성 > 기능 > 디자인** 순으로 판단한다.
2. 확인하지 않은 API 경로·필드·SDK 함수명을 추측하지 않는다. 공식 문서·실데이터·설치된 패키지 타입 정의로 확인하고 근거(URL·확인일)를 `docs/DECISIONS.md`에 남긴다.
3. 상태는 `구현` / `자동 테스트 통과` / `샌드박스 확인` / `토스앱 확인`으로 구분해 README 상태표에 기록한다. 실행하지 않은 것을 완료로 보고하지 않는다.
4. 없는 식당·가격·영업 상태·도보 시간을 만들어 내지 않는다. 후보가 부족하면 부족하다고 말한다.
5. 커밋·푸시·콘솔 업로드·출시 요청은 사용자 승인 없이 하지 않는다.

---

## 1. 원본 대비 바뀐 점 (왜 바꿨는지)

| 원본(Expo 앱) | 토스 미니앱 버전 | 이유 |
|---|---|---|
| React Native + Expo + Expo Router | Vite + React + TS + `@apps-in-toss/web-framework` (CSR) | 앱인토스 WebView SDK. SSR·iframe·eval 불가 |
| 하단 탭 3개 | 앱인토스 네비게이션 바 + 단일 흐름(홈 → 방 → 결과) | 토스 네비게이션 바 사용 의무, 자체 뒤로가기 중복 금지 |
| Universal/App Link·도메인·QR | `Share.createLink({ path: 'intoss://<appName>/room?t=<토큰>' })` + `Share.sendMessage` | 도메인·연관 파일 불필요, 공유 미리보기 자동 |
| 익명 식별자 직접 생성 | 토스 SDK의 사용자 식별 기능(익명 키 — 함수명은 문서로 확인) | 토스 로그인은 사업자 등록 필요 → 사용 안 함 |
| **카카오 로컬 / 네이버 지역 검색 API로 후보 검색** | **공공데이터 '일반음식점' 인허가 데이터를 빌드 타임에 가공한 정적 후보 목록** + 수동 추가 | 카카오 답변: 로컬 API 응답 원본·가공 데이터를 기기·서버에 저장 불가, 실시간 호출만 허용, 임시 저장(20분)도 불가 → **방에 후보를 저장하는 구조와 충돌**. 공공데이터는 '이용허락범위 제한 없음'이라 저장·가공 가능 |
| 알레르기 자유 입력(allergyNotes) | **'못 먹는 것' 칩 선택만**, 이유는 묻지도 저장하지도 않음 | 알레르기는 건강 정보(민감정보) → 서버 저장 시 별도 동의 등 부담. 목적상 "무엇을 빼야 하는지"만 있으면 충분 |
| 로컬 알림·푸시 | 없음(방 안 마감 카운트다운만) | 토스 스마트 발송은 건당 9.9원 유료 |
| 방문 기록 SQLite | SDK `Storage`(기기 로컬) | 서버 저장 불필요 |
| 광고는 MVP 이후 | 결과 화면 하단 배너 1개(Phase 4) | 토스 광고는 사업자 없이 누적 5,000원까지 시작 가능 |

---

## 2. 제품 정의

### 브랜드 (사용자 확정)
- **이름: 점심합의** — 기능을 그대로 말하는 직관적인 이름.
- **표시 이름(토스 콘솔·앱스토어): "점심합의 - 같이 정하는 오늘 점심"** — 콘솔 앱 이름 칸에 하이픈 뒤 문구까지 넣을 수 있는지(글자 수·특수문자 규칙) 확인해 보고. 안 되면 표시 이름은 "점심합의", "같이 정하는 오늘 점심"은 소개 첫 줄에 넣는다. 국문 이름은 콘솔 등록명과 일치해야 한다.
- **영문 브랜드 표기: LUNCH AGREEMENT** — 로고 워드마크·OG 이미지·첫 화면 보조 표기에만 사용(대문자 고정). 토스 국문 이름 칸에는 쓰지 않는다.
- **메인 카피: "오늘 점심, 우리끼리 빠르게 정하자."** — 첫 화면, 공유 미리보기, 설정 > 앱 정보.
- **기능 라인: "조건 모으기 · 식당 추천 · 다 같이 투표"** — 첫 화면 메인 카피 아래, 콘솔 소개 둘째 줄. 가운뎃점(·) 앞뒤 공백 1칸 표기 고정. 이 세 단계가 실제 화면 흐름(내 조건 → 후보 → 투표)과 일치해야 한다.
- 원본 한 줄 정의 "오늘 점심, 각자 원하는 조건을 모아 다 같이 빠르게 결정한다."는 콘솔 상세 설명 본문에 사용.
- 공유 메시지 기본 문구: "점심합의 - 같이 정하는 오늘 점심\n오늘 점심, 우리끼리 빠르게 정하자. 내 조건만 넣어 줘!" + 링크.
- 장점: 이름에 '점심'이 들어가 토스 검색(미니앱 이름 기준)에 바로 걸린다. 콘솔 설명·키워드에는 "점심 투표, 점심 메뉴, 점심 정하기, 회식 장소"를 추가한다.
- 주의(상표): '점심'+'합의'는 서비스 내용을 그대로 설명하는 일반 단어 조합이라 상표 등록 시 식별력이 약하다는 이유로 거절될 수 있다. 앱 이름으로 쓰는 데 문제는 없지만, 독점권이 필요하면 로고(도형)와 결합한 형태로 출원하는 방안을 사용자에게 보고한다. 웹 검색(2026-10-30)에서 '점심합의'라는 이름의 앱·서비스는 찾지 못했다. KIPRIS 확인은 출시 전에 한다.
- **기술 식별자 `appName`: `jeomsimhabui`** (사용자 지정). `apps-in-toss.config.ts`의 `appName`, 딥링크 `intoss://jeomsimhabui/...`, CORS origin(`https://jeomsimhabui.apps.tossmini.com` 등), package.json `name`에 같은 값을 쓴다. 콘솔에서 이미 사용 중이면 사용자에게 보고하고 임의로 바꾸지 않는다. 저장소·폴더 이름은 `LunchAgree` 유지.
- 같은 워크스페이스에서 핵심 기능이 비슷한 앱 여러 개는 제한된다(앱인토스 정책). 사잇(중간역 찾기)과 점심합의(식당 합의)는 핵심 기능이 다르지만, 콘솔 등록 시 차이를 설명문에 명확히 적는다. 미니앱끼리 서로 이동을 유도하지 않는다(자사 서비스 이동 유도 금지).

### 한 줄 정의
"오늘 점심, 각자 조건을 모아 3분 안에 다 같이 정한다." 방장이 링크를 돌리면 동료들이 가입 없이 예산·못 먹는 것·걷기 한도를 넣고, 앱이 조건을 통과한 후보를 좁혀 투표로 끝낸다.

### 경쟁 확인 결과 (2026-10-30, 웹 검색 기준)
- 토스 미니앱에서 같은 기능은 찾지 못함(공개 목록이 없어 최종 확인은 토스 앱 검색 "점심·메뉴·뭐먹지·투표").
- 앱스토어: Selunch(메뉴 룰렛), '뭐먹지?'(개인 추천·지도 연동), '오늘 뭐 먹지?' 등 **개인용 메뉴 추천이 대부분**, 그룹 조건 취합+투표는 확인되지 않음. 해외 Voto(링크 투표)는 범용 투표.
- 실제 대체재는 **카카오톡 단톡방 투표** → 차별점은 "조건을 모아 후보를 자동으로 좁히는 것"과 "3분 안에 끝"이어야 한다.

### 하지 않는 것
예약·결제·배달, 실시간 영업 여부 보장, 메뉴 가격 자동 수집, 리뷰·평점, 카카오·네이버 데이터 저장, 스크래핑, 위치 추적, 강제 가입, 알레르기 안전 보증, 광고를 추천처럼 위장.

---

## 3. 확인된 사실 (구현 전 재확인)

### 3-1. 데이터
| 데이터 | 내용 | 이용 조건 | 용도 |
|---|---|---|---|
| 행정안전부_식품_일반음식점 (data.go.kr 15045016) | 전국 일반음식점 인허가: 인허가일자, **영업상태**, 사업장명, 소재지주소, 좌표(**EPSG:5174**). 2026-01부터 지방행정 인허가 데이터가 공공데이터포털로 통합·API 제공 | 이용허락범위 제한 없음 | **후보 기본 데이터** |
| 전국일반음식점표준데이터 (data.go.kr 15096283) | 시도·시군구 일반음식점 등록 현황, 수시 갱신(최종 2025-11-27 확인) | 이용허락범위 제한 없음 | 교차 검증 |
| 착한가격업소 현황 (지자체별, 예: 가평군 15125004) | 업소명, 주소, 대표메뉴1~3·가격, 업종, 위경도 | 제한 없음(지자체별 확인) | (선택) 가격 힌트 — 커버리지가 지자체별이라 Phase 5 |
| 카카오 로컬 API | 실시간 호출만 허용, 응답 원본·가공 데이터 기기·서버 저장 금지, 임시 저장도 불가, 장소 ID만 저장 후 재호출은 허용 안내 | 카카오 데브톡 공식 답변 | **MVP 미사용** |
| 네이버 지역 검색 API | 이번 조사에서 문서 접근 실패 → 한도·저장 조건 미확인 | 미확인 | **MVP 미사용** |
| 지하철역 목록 | 사잇 프로젝트의 역 데이터(서울시·서울교통공사, 공공누리 1유형/제한 없음) | 출처 표시 | 기준점 선택(역 이름으로) |

- 공공데이터 일반음식점에는 **메뉴·가격·영업시간·실제 간판명이 없거나 다를 수 있다.** 화면에 "인허가 정보 기준, 실제 상호·영업 여부는 다를 수 있어요"를 표시한다.
- '업태구분' 등 음식 종류 컬럼이 있는지, 값이 무엇인지는 Phase 0에서 실데이터로 확인한다(없으면 사업장명 규칙 기반 추정 + "추정" 표시, 또는 사용자 태그).

### 3-2. 앱인토스 (사잇 기획서 §2-2와 동일 항목은 요약)
- WebView SDK, `npx ait init`, `apps-in-toss.config.ts`, `appName` 콘솔명 일치.
- 공유: `Share.createLink({ path, ogImageUrl? })` → `Share.sendMessage({ message })`. 경로에 쿼리 가능. 출시 전 `intoss-private://`.
- 저장: `Storage.getItem/setItem/...`(기기 로컬).
- 외부 서버 CORS: `https://<appName>.apps.tossmini.com`, `https://<appName>.private-apps.tossmini.com`, SDK 3.x는 `<appName>.web.tossmini.com`, `<appName>.private-web.tossmini.com`도.
- 체크리스트: 라이트 모드, 진입 즉시 바텀시트 금지, 2초 이상 지연 금지, 권한 사전 동의·거부해도 동작, 자사 사이트 이동 금지(공공기관·제휴기관 공식 페이지 연결은 허용 항목).
- **외부 지도 앱(카카오맵·네이버지도) 검색 링크로 보내는 것이 허용되는지는 미확인** → Phase 3에서 문서 재확인 또는 채널톡 문의. 안 되면 "주소 복사" 버튼으로 대체.
- 비용: 입점 수수료 없음, 광고 수수료 15%, 스마트 발송 9.9원/건. 광고 수익 누적 5,000원 초과 시 사업자 등록.
- 노출: 같은 카테고리 안에서 재방문율·전환율 비교 → 콘솔에 전환 지표 "점심 결정 완료" 등록.

---

## 4. 아키텍처

```
[데이터 빌드 — GitHub Actions 주 1회 + 수동]
 data-build/ (Node 24 + TS)
  일반음식점 API/파일 → 영업상태=영업 필터 → EPSG:5174→WGS84 변환(proj4, MIT)
  → 지하철역별 반경 1km 후보 샤드 생성 → 검증 → GitHub Pages(public 저장소, 무료)
  /v1/stations.json                (역 ID·이름·좌표 — 사잇과 같은 역 ID 체계)
  /v1/near/{stationId}.json        (반경 1km 영업 중 음식점: id, 이름, 주소, 좌표, 종류태그, 기준일)

[미니앱 — Vite + React + TS + @apps-in-toss/web-framework]
  domain/  (순수 TS) 조건 집계 · 후보 필터 · 점수 · 설명 · 투표 집계
  화면: 홈 → 방 만들기 → (공유) → 내 조건 → 후보 → 투표 → 결과
  Storage: 내 기본 조건, 최근 방, 방문 기록(기기 로컬)

[공유 방 — Supabase Free]
  rooms / participants / preferences / candidates / votes (RLS + RPC만으로 쓰기)
  방은 당일 23:59(KST) 또는 생성 후 12시간 중 이른 시각에 만료 → 일일 정리 작업으로 삭제
```

### 핵심 결정 (DECISIONS.md에 근거와 함께)
- **후보 데이터 = 공공데이터 정적 샤드**: 저장·가공이 허용되고, 런타임 API 호출·키·서버 프록시가 필요 없다. 카카오·네이버 API는 저장 금지·조건 미확인으로 MVP에서 제외한다.
- **방 데이터만 서버에**: Supabase Free. 점심 앱 특성상 평일 매일 사용 → 1주 비활성 일시 중지 위험은 낮지만 README에 기록하고, 중지 시 "로컬 체험 모드"로 안내한다.
- **방 공통 모듈 `room-core`**: 방 생성·토큰·참여·만료·RLS 패턴은 사잇 Phase 5(각자 입력 세션)와 같다. `packages/room-core`(순수 TS + SQL 마이그레이션 + RLS 테스트)로 분리하고, 먼저 만든 쪽에서 다른 쪽으로 **복사**한다(저장소 간 import 금지).
- 거리: 직선거리(Haversine)만 계산한다. 도보 시간은 `직선거리 × 1.3 ÷ 분당 75m`로 **"약 N분(추정)"** 표시하고 계수는 `lunch-policy.ts` 한 곳에서 관리한다.

---

## 5. 데이터 모델

```ts
// 정적 후보 (data-build 산출물)
interface Place { id: string; name: string; address: string; lat: number; lng: number;
  tags: string[];            // 한식·중식·일식·양식·분식 등 (원천 컬럼 기반, 없으면 추정 표시)
  tagSource: 'source' | 'estimated'; baseDate: string; }

// 방 (Supabase)
interface Room { id: string; tokenHash: string; shortCode: string; title: string;
  stationId: string | null; meetingText: string | null;   // 역 또는 직접 입력 기준점
  date: string; returnBy: string; mealMinutes: number; maxWalkMinutes: number;
  defaultBudget: number | null; status: 'COLLECTING' | 'VOTING' | 'DECIDED' | 'CLOSED';
  expiresAt: string; hostParticipantId: string; }
interface Participant { id: string; roomId: string; anonHash: string; nickname: string; isReady: boolean; }
interface Preference { participantId: string; roomId: string; maxBudget: number | null;
  likes: string[];           // 음식 종류 태그
  cannotEat: string[];       // 고정 칩 목록 중 선택: 해산물·돼지고기·소고기·매운 음식·견과류·유제품·밀가루·날것 등 (이유 필드 없음)
  maxWalkMinutes: number | null; }
interface Candidate { id: string; roomId: string; source: 'PUBLIC_DATA' | 'MANUAL';
  placeId: string | null; name: string; address: string | null; tags: string[];
  priceHint: number | null; priceType: 'USER_REPORTED' | 'UNKNOWN';
  addedBy: string; }
interface Vote { roomId: string; participantId: string; candidateId: string; } // (roomId, participantId) 1표, 변경 시 upsert
```

- 링크에는 토큰만 넣는다(닉네임·조건 금지). 토큰은 128bit 랜덤, DB에는 해시만. 수동 입력용 6자리 `shortCode`는 시도 횟수 제한.
- 참가자 화면에는 **누가** 무엇을 못 먹는지 보여 주지 않는다. "해산물 제외됨"처럼 그룹 결과만 표시한다. 예산도 개인 값 대신 "그룹 상한 ○○원"만.

---

## 6. 추천 규칙 (원본 §4 유지, 단순화)

- **하드 조건(자동 완화 금지)**: `cannotEat` 합집합, 방장 지정 복귀 시각, 각자 `maxBudget`의 최솟값(가격 정보가 있는 후보에만 적용).
- `cannotEat` 판정: 공공데이터에는 메뉴가 없으므로 태그 기반(예: '해산물' 제외 → '횟집·해물' 태그 후보 제외)으로만 거르고, 나머지는 **"메뉴 확인 필요"**로 표시한다. 알레르기 안전을 보증하는 문구는 절대 쓰지 않는다.
- **소프트 선호**: `likes`를 참가자당 합 1로 정규화, 가까울수록 가점.
- 출력: 후보 최대 3개 + 이유 문장("4명 중 3명이 원한 한식", "약 6분 거리(추정)", "가격 미확인"). 점수 숫자는 노출하지 않는다.
- 후보 부족 시: "조건에 맞는 후보가 부족해요" + 어떤 조건(거리/예산/종류)이 막았는지 그룹 수준으로 표시 → 사용자가 직접 완화(못 먹는 것은 완화 버튼 없음).
- 동률: 자동 결정하지 않고 동률 후보 표시 → 방장이 고르거나 재투표.

---

## 7. 라이선스·법적·정책

1. **출처 표시**: 후보 카드·설정 > 데이터 출처에 "행정안전부 일반음식점 인허가 정보(기준일 ○○)". 지하철역 데이터 출처도 표시.
2. **카카오·네이버**: MVP에서 API 호출 없음. 외부 지도 검색 링크만(허용 확인 후). 그들의 지도·로고·장소 사진을 쓰지 않는다.
3. **식당 상호**: 공공데이터 사업장명을 그대로 표시. 식당 로고·사진·메뉴판 이미지를 쓰지 않는다. 빈 이미지 자리는 자체 아이콘.
4. **개인정보**: 서버에는 닉네임·예산·좋아하는/못 먹는 음식 칩·투표만, 방 만료 시 삭제. 참여 전 "이 방 참여자와 서버에 공유돼요" 안내. 알레르기·종교·건강 사유는 수집하지 않는다. 개인정보 처리방침 화면 필수.
5. **원본 기획 보호**: 경쟁 앱 화면·문구 복제 금지(원본 §0.2 유지).
6. **오픈소스**: 의존성 라이선스를 빌드 시 수집해 앱 내 화면 제공(`Cutpick/scripts/generate-oss-licenses.mjs` 참고). GPL/AGPL 발견 시 중단 보고. proj4·Supabase JS·TDS 등 라이선스 LICENSES.md 기록.
7. **이름**: '점심합의'와 영문 'LUNCH AGREEMENT'를 KIPRIS 제9류·제42류·제43류(음식 제공 관련) 기준으로 동일·유사 상표를 검색해 보고. 'LUNCH AGREEMENT'도 일반 영단어 조합이라 식별력이 약하다. 식별력 약함(§2 브랜드 주의) 때문에 출원한다면 로고 결합형을 검토. 출원은 사용자 결정.
8. **고지문**: "인허가 정보 기준이라 실제 상호·영업 여부·메뉴·가격과 다를 수 있어요. 거리와 시간은 직선거리 기반 추정이에요."

---

## 8. 프로젝트 구조

```
LunchAgree/
├─ README.md / CLAUDE.md
├─ docs/  DECISIONS · DATA_SOURCES · PLACE_DATA_POLICY · CONSENSUS_ALGORITHM · TOSS_COMPLIANCE · PRIVACY · SECURITY · LICENSES · TESTING
├─ packages/
│  └─ room-core/            # 방·토큰·참여·만료·투표 공통(순수 TS) + supabase/migrations + supabase/tests(RLS)
├─ data-build/
│  ├─ raw/                  # 원본(기준일 포함 파일명), 수정 금지
│  ├─ src/  fetch.ts · filter-open.ts · reproject.ts · tag.ts · shard-by-station.ts · validate.ts · report.ts
│  └─ tests/
├─ app/
│  ├─ apps-in-toss.config.ts · index.html
│  └─ src/
│     ├─ domain/            # lunch-policy.ts · group-constraints.ts · candidate-filter.ts · scoring.ts · explanations.ts · voting.ts
│     ├─ data/              # places-api.ts(정적 샤드 fetch+캐시) · room-repo.ts(Supabase RPC만)
│     ├─ features/          # room-create · join · preferences · candidates · vote · result · history
│     ├─ storage/           # toss-storage / web-storage 어댑터
│     ├─ ads/               # 결과 화면 배너 1개
│     └─ routes/
└─ .github/workflows/  ci.yml · data-build.yml(주 1회 + 수동, 실패 시 이전 데이터 유지)
```

---

## 9. 단계별 계획과 완료 조건

### Phase 0 — 데이터·정책 검증 게이트
- 일반음식점 API/파일 확인: 컬럼명(업태 컬럼 유무), 영업상태 값, 좌표 결측률, 갱신 주기 → DATA_SOURCES.md.
- 서울 주요 역 10곳(사용자 지정 가능)에서 반경 1km 영업 중 음식점 수·종류 태그 확보율 측정.
- 토스 외부 지도 링크 허용 여부 확인 방법 정리(문서 재확인 → 안 되면 사용자에게 채널톡 문의 요청).
- **완료 조건**: 역별 후보 수 중앙값 100개 이상, 종류 태그 확보율 70% 이상이면 진행. 미달이면 "수동 후보 + 투표"만으로 MVP 범위를 줄이는 안을 보고.

### Phase 1 — 도메인 엔진 (순수 TS)
- 조건 집계·필터·점수·설명·투표·동률 단위 테스트(원본 §12.1 항목 중 해당분 전부).
- **완료 조건**: test·typecheck 통과, 가짜 후보 생성 없음 테스트 포함.

### Phase 2 — 로컬 모드 앱 (브라우저)
- 혼자 쓰는 체험: 기준역 선택 → 조건 입력 → 후보 3개 → 수동 후보 추가. 방문 기록 Storage.
- **완료 조건**: 360px 폭 가로 스크롤 없음, 후보 표시 2초 이내 측정 기록.

### Phase 3 — 공유 방 + 토스 연동
- `room-core` + Supabase 마이그레이션·RLS·RPC, 만료 정리 작업.
- 앱인토스 SDK 설치, `appName` 확정(사용자), 공유 링크로 참여, 익명 키 해시로 중복 참여 방지, 실시간(Realtime 또는 5초 폴링) 선택 근거 기록.
- 외부 지도 링크 또는 주소 복사(허용 여부 결과에 따름).
- TOSS_COMPLIANCE.md 체크리스트 대응.
- **완료 조건**: RLS 테스트 실제 실행·통과, 샌드박스 확인, 사용자가 두 기기(QR `intoss-private://`)로 참여·투표 E2E 확인.

### Phase 4 — 인앱 광고
- 결과 화면 하단 배너 1개(WebView 배너 지원 재확인). 투표 화면에는 광고 없음.
- **완료 조건**: 테스트 광고 노출 기록, 사업자 등록 유예 조건 README 명시.

### Phase 5 — (선택) 리텐션·가격 힌트
- "지난번 멤버로 다시 만들기", "최근 우리 팀이 간 곳"(기기 로컬, 방장 기기 기준).
- 착한가격업소 데이터가 있는 지역만 가격 힌트(출처·기준일 표시).

### Phase 6 — (선택) 실시간 장소 검색
- 카카오 로컬 등은 **저장 없이 실시간 표시** 조건으로만, 방 후보로 저장하지 않는 설계가 가능할 때만. 약관 재확인·사용자 승인 후.

---

## 10. 재사용 (복사·이식)

| 가져올 것 | 위치 |
|---|---|
| 토스 사실표·체크리스트 대응·공유 링크 방식 | `saeit-super-prompt.md` §2-2, Phase 3 |
| 지하철역 ID·이름·좌표 | 사잇 `data-build` 산출물(같은 역 ID 체계) |
| Supabase 스키마·RLS·테스트, 무료 한도 fail-closed | `C:\eclipse_AI\Cutpick\supabase\`, `Cutpick\docs\COSTS_AND_DISTRIBUTION.md` |
| 오픈소스 라이선스 화면 | `C:\eclipse_AI\Cutpick\scripts\generate-oss-licenses.mjs` |
| 공공데이터 일일/주간 Actions | `C:\eclipse_AI\FactBokAI\.github`, `C:\eclipse_AI\StrangeRecords\.github` |
| Pages 정적 배포 | `C:\eclipse_AI\TechLog\.github` |
| README 상태표·DECISIONS·Work Log 규칙 | `C:\eclipse_AI\Ddalggak\AGENTS.md` |
| 원본 기획의 테스트 목록·완료 기준 | `JeomsimHabiui_ClaudeCode_SuperPrompt.md` §12, §16 (Expo 관련 항목 제외) |

---

## 11. 사용자가 직접 할 일
1. data.go.kr 활용신청·서비스 키 발급(GitHub Secret 등록, 커밋 금지)
2. Supabase 무료 프로젝트 생성, URL·anon key 전달(service_role 키는 전달·커밋 금지)
3. 앱인토스 콘솔 등록(appName 확정), 업로드·QR 테스트·출시 요청
4. 외부 지도 링크 허용 여부 채널톡 문의(필요 시)
5. '점심합의' KIPRIS 확인, 필요 시 로고 결합형 상표 출원 여부 결정

## 12. 첫 응답에서 할 일
1. 이 문서와 원본 기획 사이의 충돌·모호점을 최대 5개 정리한다.
2. Phase 0 계획(확인할 데이터 URL, 측정할 역 10곳 제안, 측정 방법)을 제시한다.
3. 사잇과 `room-core`를 어느 쪽에서 먼저 만들지 사용자에게 묻는다.
