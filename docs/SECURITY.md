# 보안

- **키**: 앱에는 Supabase `anon` 키만(`VITE_SUPABASE_ANON_KEY`). `service_role` 키·data.go.kr 서비스 키는 앱·저장소에 넣지 않는다(키는 GitHub Secret).
- **테이블 직접 접근 차단**: 모든 테이블 RLS 활성 + 정책 0개. anon은 security definer RPC만 실행 가능. 내부 함수(`_join`, `_room_by_*`, `_participant`, `purge_expired_rooms`)는 실행 권한 회수.
- **토큰**: 128bit 랜덤(base64url 22자). DB엔 SHA-256 해시만. 링크엔 토큰만.
- **참가자 인증**: 참여 시 클라이언트가 만든 128bit secret → DB엔 해시. 이후 모든 쓰기·읽기는 (room_id, participant_id, secret) 확인.
- **6자리 코드**: 헷갈리는 글자 제외 31자, 익명 해시당 시간 10회 시도 제한(`join_code_attempts`).
- **방장 권한**: 상태 변경(투표 시작·마감·재투표·결정)은 `host_participant_id`만.
- **입력 검증**: 닉네임 1~10자·제어문자·꺾쇠 금지(TS·SQL check 둘 다), 못 먹는 것은 고정 id 목록(check), 후보·태그 수 상한, 좌표 범위.
- **fail-closed**: `lunch_settings.rooms_enabled`, 활성 방 상한(무료 한도 보호). 데이터 빌드 실패 시 이전 Pages 유지.
- **진입 링크**: `intoss(-private)://…/room?t=` 형식·토큰 형식이 맞을 때만 이동, 아니면 홈.
- 검증: `npm run test:sql`(anon 직접 SELECT/INSERT 차단, 잘못된 secret 거부, 방장 외 상태 변경 거부, 중복 참여 방지, 내부 함수 실행 차단, 개인 예산 비노출).
