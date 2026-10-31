-- RLS·RPC 검사 (Cutpick/supabase/tests/rls_test.sql 형식). 실행: supabase test db  또는 psql로 로컬 DB에 실행.
-- 상태: 작성만 함 — Supabase 프로젝트가 아직 없어 실제 실행 전(README 상태표 참고).
-- 실패하면 exception으로 멈추고, 끝까지 가면 'RLS OK'를 출력한다. 전체를 트랜잭션으로 감싸 흔적을 남기지 않는다.
begin;

-- 1) 방장: 방 만들기 (anon 역할로)
set local role anon;
select set_config('test.host', (public.create_room(
  'AAAAAAAAAAAAAAAAAAAAAA', '23456A', '회사 점심', '본관 1층', '13:00', 10, 10000,
  repeat('a', 64), 'host-secret-0123456789ab', '나'))::text, true);

-- 2) anon은 테이블을 직접 읽을 수 없다(정책 없음 → 0행)
do $$ begin
  if (select count(*) from public.rooms) <> 0 then raise exception 'anon can read rooms'; end if;
  if (select count(*) from public.preferences) <> 0 then raise exception 'anon can read preferences'; end if;
end $$;

-- 3) 직접 insert 불가
do $$ begin
  begin
    insert into public.votes (room_id, participant_id, candidate_id) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
    raise exception 'anon can insert votes';
  exception when insufficient_privilege or others then
    if sqlerrm = 'anon can insert votes' then raise; end if;
  end;
end $$;

-- 4) 참가자 참여 + 조건 저장, 다른 사람 비밀값으로는 쓰기 실패
do $$
declare
  host jsonb := current_setting('test.host')::jsonb;
  guest jsonb;
  room uuid := (host->>'roomId')::uuid;
  st jsonb;
begin
  guest := public.join_room('AAAAAAAAAAAAAAAAAAAAAA', repeat('b', 64), 'guest-secret-0123456789a', '지민');
  perform public.save_preference(room, (guest->>'participantId')::uuid, 'guest-secret-0123456789a', 9000,
                                 array['korean'], array['seafood'], 10);
  perform public.save_preference(room, (host->>'participantId')::uuid, 'host-secret-0123456789ab', 12000,
                                 array['korean','noodle'], array['spicy'], 15);
  begin
    perform public.save_preference(room, (guest->>'participantId')::uuid, 'wrong-secret-0123456789', 1000, '{}', '{}', 5);
    raise exception 'wrong secret accepted';
  exception when others then
    if sqlerrm <> 'NOT_PARTICIPANT' then raise; end if;
  end;

  -- 5) 그룹 요약: 예산 최솟값, 못 먹는 것 합집합, 개인 값 미노출
  st := public.get_room_state(room, (guest->>'participantId')::uuid, 'guest-secret-0123456789a');
  if (st->'group'->>'budgetCap')::int <> 9000 then raise exception 'budgetCap %', st->'group'; end if;
  if jsonb_array_length(st->'group'->'cannotEat') <> 2 then raise exception 'cannotEat %', st->'group'; end if;
  if (st->'group'->'likeCounts'->>'korean')::int <> 2 then raise exception 'likeCounts %', st->'group'; end if;
  if st::text like '%12000%' then raise exception 'other participant budget leaked'; end if;

  -- 6) 방장 아닌 사람은 상태 변경 불가
  begin
    perform public.set_room_status(room, (guest->>'participantId')::uuid, 'guest-secret-0123456789a', 'VOTING', null);
    raise exception 'guest changed status';
  exception when others then
    if sqlerrm <> 'HOST_ONLY' then raise; end if;
  end;

  -- 6-1) 후보에는 식당 공개 좌표만, 사용자 위치 파생값(도보 분·거리·기준점) 필드는 없다
  perform public.add_candidate(room, (guest->>'participantId')::uuid, 'guest-secret-0123456789a', 'PUBLIC_DATA', 'P1', '테스트식당', '서울', 37.5, 127.0, array['korean'], null);
  st := public.get_room_state(room, (guest->>'participantId')::uuid, 'guest-secret-0123456789a');
  if (st->'candidates'->0->>'lat')::float <> 37.5 then raise exception 'lat %', st->'candidates'; end if;
  if st::text ~ '"(walkMinutes|walk_minutes|distance|stationId|origin)"' then raise exception 'user location field leaked'; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and column_name ~ '^(walk_minutes|user_lat|user_lng|origin|station_id)$') then
    raise exception 'user location column exists';
  end if;

  -- 7) 같은 익명 키로 다시 참여하면 새 참가자를 만들지 않는다
  guest := public.join_room('AAAAAAAAAAAAAAAAAAAAAA', repeat('b', 64), 'guest-secret-new-0123456', '지민2');
  if (guest->>'rejoined')::boolean is not true then raise exception 'duplicate participant'; end if;
end $$;

-- 8) 내부 함수는 anon 실행 불가
do $$ begin
  begin
    perform public.purge_expired_rooms();
    raise exception 'anon can purge';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'RLS OK';
rollback;
