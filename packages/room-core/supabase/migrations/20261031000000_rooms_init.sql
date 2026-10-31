-- 점심합의 공유 방 스키마 (Supabase Free). Cutpick/supabase 패턴을 따른다.
-- 적용: supabase db push  (또는 Free 프로젝트 SQL 편집기에 붙여넣기)
-- 원칙
--  * 모든 테이블 RLS 켜고 anon/authenticated 정책은 하나도 만들지 않는다 → 테이블 직접 읽기·쓰기 불가.
--  * 읽기·쓰기는 아래 security definer RPC만. 참여는 방 토큰(원문)을 받아 서버에서 SHA-256 해시로 비교하거나(DB엔 해시만)
--    6자리 코드(시간당 시도 제한)로 한다.
--  * 참여 후 모든 호출은 (room_id, participant_id, participant_secret)로 확인한다. secret 원문은 기기에만, DB엔 해시.
--  * 개인 조건은 밖으로 내보내지 않는다. get_room_state는 그룹 요약(상한 최솟값·못 먹는 것 합집합·좋아요 수)만 돌려준다.
--  * 알레르기·종교·건강 '사유'는 받지 않는다(cannot_eat은 고정 칩 값만).
--  * 사용자 위치(좌표)는 받지 않는다: 방에 기준점 좌표 없음, 후보에는 추가한 사람 기준 도보 분(walk_minutes)만.
--  * service_role 키는 앱에 넣지 않는다.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 운영 스위치(fail-closed): 무료 한도 근처에서 새 방 생성을 막는다
-- ---------------------------------------------------------------------------
create table if not exists public.lunch_settings (
  id boolean primary key default true check (id),
  rooms_enabled boolean not null default true,
  max_active_rooms int not null default 5000 check (max_active_rooms between 0 and 100000),
  join_code_attempts_per_hour int not null default 10 check (join_code_attempts_per_hour between 1 and 100)
);
insert into public.lunch_settings (id) values (true) on conflict do nothing;
alter table public.lunch_settings enable row level security;

-- ---------------------------------------------------------------------------
-- 테이블
-- ---------------------------------------------------------------------------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  short_code text not null unique check (short_code ~ '^[2-9A-HJKMNP-Z]{6}$'),
  title text not null check (char_length(title) between 1 and 30),
  meeting_text text check (meeting_text is null or char_length(meeting_text) <= 40),
  date date not null,
  return_by text check (return_by is null or return_by ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  meal_minutes int not null default 50 check (meal_minutes between 10 and 180),
  max_walk_minutes int not null default 10 check (max_walk_minutes between 1 and 30),
  default_budget int check (default_budget is null or default_budget between 1000 and 100000),
  status text not null default 'COLLECTING' check (status in ('COLLECTING','VOTING','DECIDED','CLOSED')),
  decided_candidate_id uuid,
  host_participant_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists idx_rooms_expires on public.rooms (expires_at);
alter table public.rooms enable row level security;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  anon_hash text not null check (anon_hash ~ '^[0-9a-f]{64}$'),
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  nickname text not null check (char_length(nickname) between 1 and 10 and nickname !~ '[<>[:cntrl:]]'),
  is_ready boolean not null default false,
  created_at timestamptz not null default now(),
  unique (room_id, anon_hash) -- 같은 토스 사용자의 중복 참여 방지
);
alter table public.participants enable row level security;

create table if not exists public.preferences (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  max_budget int check (max_budget is null or max_budget between 1000 and 100000),
  likes text[] not null default '{}' check (cardinality(likes) <= 12),
  cannot_eat text[] not null default '{}'
    check (cannot_eat <@ array['seafood','pork','beef','chicken','spicy','raw','nuts','dairy','wheat']::text[]),
  max_walk_minutes int check (max_walk_minutes is null or max_walk_minutes between 1 and 30),
  updated_at timestamptz not null default now()
);
alter table public.preferences enable row level security;

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  source text not null check (source in ('PUBLIC_DATA','MANUAL')),
  place_id text check (place_id is null or char_length(place_id) <= 64),
  name text not null check (char_length(name) between 1 and 40),
  address text check (address is null or char_length(address) <= 120),
  walk_minutes int check (walk_minutes is null or walk_minutes between 1 and 60),
  tags text[] not null default '{}' check (cardinality(tags) <= 4),
  price_hint int check (price_hint is null or price_hint between 1000 and 100000),
  price_type text not null default 'UNKNOWN' check (price_type in ('USER_REPORTED','UNKNOWN')),
  added_by uuid not null references public.participants(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_candidates_room on public.candidates (room_id);
alter table public.candidates enable row level security;

create table if not exists public.votes (
  room_id uuid not null references public.rooms(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (room_id, participant_id) -- 1인 1표, 바꾸면 upsert
);
alter table public.votes enable row level security;

create table if not exists public.join_code_attempts (
  anon_hash text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists idx_join_attempts on public.join_code_attempts (anon_hash, attempted_at);
alter table public.join_code_attempts enable row level security;

-- ---------------------------------------------------------------------------
-- 내부 도우미
-- ---------------------------------------------------------------------------
create or replace function public._sha256(p text) returns text
language sql immutable as $$ select encode(extensions.digest(p, 'sha256'), 'hex') $$;

-- 당일 23:59(KST) 또는 12시간 뒤 중 이른 시각 (room-core/src/expiry.ts와 같은 규칙)
create or replace function public.room_expires_at(p_created timestamptz) returns timestamptz
language sql immutable as $$
  select least(
    p_created + interval '12 hours',
    ((p_created at time zone 'Asia/Seoul')::date + time '23:59') at time zone 'Asia/Seoul'
  )
$$;

create or replace function public._room_by_token(p_token text) returns public.rooms
language plpgsql stable security definer set search_path = public as $$
declare r public.rooms;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{22}$' then raise exception 'INVALID_TOKEN'; end if;
  select * into r from public.rooms where token_hash = public._sha256(p_token) and expires_at > now();
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  return r;
end $$;

create or replace function public._room_by_id(p_room uuid) returns public.rooms
language plpgsql stable security definer set search_path = public as $$
declare r public.rooms;
begin
  select * into r from public.rooms where id = p_room and expires_at > now();
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  return r;
end $$;

create or replace function public._participant(p_room uuid, p_pid uuid, p_secret text) returns public.participants
language plpgsql stable security definer set search_path = public as $$
declare pt public.participants;
begin
  select * into pt from public.participants
   where id = p_pid and room_id = p_room and secret_hash = public._sha256(coalesce(p_secret, ''));
  if not found then raise exception 'NOT_PARTICIPANT'; end if;
  return pt;
end $$;

-- ---------------------------------------------------------------------------
-- RPC (anon에 execute만 허용)
-- ---------------------------------------------------------------------------

-- 방 만들기: 토큰·짧은 코드·참가자 비밀값은 클라이언트가 만들고 서버는 해시만 저장한다.
create or replace function public.create_room(
  p_token text, p_short_code text, p_title text, p_meeting_text text,
  p_return_by text, p_max_walk_minutes int, p_default_budget int,
  p_anon_hash text, p_secret text, p_nickname text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.lunch_settings;
  active int;
  r public.rooms;
  pt public.participants;
begin
  select * into s from public.lunch_settings where id;
  if not s.rooms_enabled then raise exception 'ROOMS_DISABLED'; end if;
  select count(*) into active from public.rooms where expires_at > now();
  if active >= s.max_active_rooms then raise exception 'ROOMS_DISABLED'; end if;
  if p_token !~ '^[A-Za-z0-9_-]{22}$' or char_length(coalesce(p_secret, '')) < 22 then raise exception 'INVALID_TOKEN'; end if;

  insert into public.rooms (token_hash, short_code, title, meeting_text, date, return_by,
                            max_walk_minutes, default_budget, expires_at)
  values (public._sha256(p_token), p_short_code, p_title, p_meeting_text,
          (now() at time zone 'Asia/Seoul')::date, p_return_by, coalesce(p_max_walk_minutes, 10),
          p_default_budget, public.room_expires_at(now()))
  returning * into r;

  insert into public.participants (room_id, anon_hash, secret_hash, nickname)
  values (r.id, p_anon_hash, public._sha256(p_secret), p_nickname) returning * into pt;
  update public.rooms set host_participant_id = pt.id where id = r.id;
  return jsonb_build_object('roomId', r.id, 'participantId', pt.id);
end $$;

create or replace function public._join(r public.rooms, p_anon_hash text, p_secret text, p_nickname text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pt public.participants;
  n int;
begin
  if r.status = 'CLOSED' then raise exception 'ROOM_CLOSED'; end if;
  if char_length(coalesce(p_secret, '')) < 22 then raise exception 'INVALID_TOKEN'; end if;
  select * into pt from public.participants where room_id = r.id and anon_hash = p_anon_hash;
  if found then
    -- 같은 사용자가 다시 들어오면(기기 저장값 유실) 비밀값만 새로 발급하고 닉네임은 유지
    update public.participants set secret_hash = public._sha256(p_secret) where id = pt.id;
    return jsonb_build_object('roomId', r.id, 'participantId', pt.id, 'rejoined', true);
  end if;
  select count(*) into n from public.participants where room_id = r.id;
  if n >= 6 then raise exception 'ROOM_FULL'; end if;
  insert into public.participants (room_id, anon_hash, secret_hash, nickname)
  values (r.id, p_anon_hash, public._sha256(p_secret), p_nickname) returning * into pt;
  return jsonb_build_object('roomId', r.id, 'participantId', pt.id, 'rejoined', false);
end $$;

create or replace function public.join_room(p_token text, p_anon_hash text, p_secret text, p_nickname text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return public._join(public._room_by_token(p_token), p_anon_hash, p_secret, p_nickname);
end $$;

-- 6자리 코드로 참여: 시간당 시도 횟수 제한(성공·실패 모두 1회로 센다)
create or replace function public.join_room_by_code(p_code text, p_anon_hash text, p_secret text, p_nickname text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.lunch_settings;
  tries int;
  r public.rooms;
begin
  select * into s from public.lunch_settings where id;
  select count(*) into tries from public.join_code_attempts
   where anon_hash = p_anon_hash and attempted_at > now() - interval '1 hour';
  if tries >= s.join_code_attempts_per_hour then raise exception 'TOO_MANY_ATTEMPTS'; end if;
  insert into public.join_code_attempts (anon_hash) values (p_anon_hash);
  select * into r from public.rooms where short_code = upper(p_code) and expires_at > now();
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  return public._join(r, p_anon_hash, p_secret, p_nickname);
end $$;

create or replace function public.save_preference(
  p_room uuid, p_pid uuid, p_secret text,
  p_max_budget int, p_likes text[], p_cannot_eat text[], p_max_walk_minutes int
) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.rooms := public._room_by_id(p_room);
  pt public.participants := public._participant(r.id, p_pid, p_secret);
begin
  insert into public.preferences (participant_id, room_id, max_budget, likes, cannot_eat, max_walk_minutes, updated_at)
  values (pt.id, r.id, p_max_budget, coalesce(p_likes, '{}'), coalesce(p_cannot_eat, '{}'), p_max_walk_minutes, now())
  on conflict (participant_id) do update
    set max_budget = excluded.max_budget, likes = excluded.likes, cannot_eat = excluded.cannot_eat,
        max_walk_minutes = excluded.max_walk_minutes, updated_at = now();
  update public.participants set is_ready = true where id = pt.id;
end $$;

create or replace function public.add_candidate(
  p_room uuid, p_pid uuid, p_secret text, p_source text, p_place_id text, p_name text,
  p_address text, p_walk_minutes int, p_tags text[], p_price_hint int
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r public.rooms := public._room_by_id(p_room);
  pt public.participants := public._participant(r.id, p_pid, p_secret);
  n int;
  cid uuid;
begin
  select count(*) into n from public.candidates where room_id = r.id;
  if n >= 30 then raise exception 'TOO_MANY_CANDIDATES'; end if;
  insert into public.candidates (room_id, source, place_id, name, address, walk_minutes, tags, price_hint, price_type, added_by)
  values (r.id, p_source, p_place_id, p_name, p_address, p_walk_minutes, coalesce(p_tags, '{}'), p_price_hint,
          case when p_price_hint is null then 'UNKNOWN' else 'USER_REPORTED' end, pt.id)
  returning id into cid;
  return cid;
end $$;

create or replace function public.cast_vote(p_room uuid, p_pid uuid, p_secret text, p_candidate uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.rooms := public._room_by_id(p_room);
  pt public.participants := public._participant(r.id, p_pid, p_secret);
begin
  if r.status <> 'VOTING' then raise exception 'NOT_VOTING'; end if;
  if not exists (select 1 from public.candidates where id = p_candidate and room_id = r.id) then
    raise exception 'CANDIDATE_NOT_FOUND';
  end if;
  insert into public.votes (room_id, participant_id, candidate_id) values (r.id, pt.id, p_candidate)
  on conflict (room_id, participant_id) do update set candidate_id = excluded.candidate_id, updated_at = now();
end $$;

-- 방장만: 상태 변경(투표 시작·결정·재투표·종료). 동률일 때 방장이 고른 후보를 p_decided로 넘긴다.
create or replace function public.set_room_status(p_room uuid, p_pid uuid, p_secret text, p_status text, p_decided uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.rooms := public._room_by_id(p_room);
  pt public.participants := public._participant(r.id, p_pid, p_secret);
begin
  if r.host_participant_id <> pt.id then raise exception 'HOST_ONLY'; end if;
  if not (
    (r.status = 'COLLECTING' and p_status in ('VOTING','CLOSED')) or
    (r.status = 'VOTING' and p_status in ('DECIDED','COLLECTING','CLOSED')) or
    (r.status = 'DECIDED' and p_status in ('VOTING','CLOSED'))
  ) then raise exception 'BAD_TRANSITION'; end if;
  if p_status = 'DECIDED' and not exists (select 1 from public.candidates where id = p_decided and room_id = r.id) then
    raise exception 'CANDIDATE_NOT_FOUND';
  end if;
  if p_status = 'VOTING' then delete from public.votes where room_id = r.id; end if;
  update public.rooms set status = p_status,
    decided_candidate_id = case when p_status = 'DECIDED' then p_decided else null end
  where id = r.id;
end $$;

-- 방 상태: 개인 조건 원본은 내보내지 않고 그룹 요약만.
create or replace function public.get_room_state(p_room uuid, p_pid uuid, p_secret text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r public.rooms := public._room_by_id(p_room);
  pt public.participants := public._participant(r.id, p_pid, p_secret);
  mine jsonb;
begin
  select to_jsonb(p) - 'room_id' into mine from public.preferences p where p.participant_id = pt.id;
  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', r.id, 'shortCode', r.short_code, 'title', r.title,
      'meetingText', r.meeting_text, 'date', r.date, 'returnBy', r.return_by, 'mealMinutes', r.meal_minutes,
      'maxWalkMinutes', r.max_walk_minutes, 'defaultBudget', r.default_budget, 'status', r.status,
      'expiresAt', r.expires_at, 'hostParticipantId', r.host_participant_id,
      'decidedCandidateId', r.decided_candidate_id),
    'me', jsonb_build_object('participantId', pt.id, 'preference', mine),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'isReady', p.is_ready,
               'hasVoted', exists (select 1 from public.votes v where v.participant_id = p.id)) order by p.created_at)
      from public.participants p where p.room_id = r.id), '[]'::jsonb),
    'group', jsonb_build_object(
      'readyCount', (select count(*) from public.preferences where room_id = r.id),
      'budgetCap', (select min(max_budget) from public.preferences where room_id = r.id),
      'walkCap', (select min(max_walk_minutes) from public.preferences where room_id = r.id),
      'cannotEat', coalesce((select jsonb_agg(distinct c) from public.preferences, unnest(cannot_eat) c
                              where room_id = r.id), '[]'::jsonb),
      -- 좋아요: 태그별 '원한 사람 수'와 참가자당 합 1로 정규화한 가중치 합
      'likeCounts', coalesce((select jsonb_object_agg(tag, cnt) from (
          select l as tag, count(*) as cnt from public.preferences, unnest(likes) l where room_id = r.id group by l) t),
        '{}'::jsonb),
      'likeWeights', coalesce((select jsonb_object_agg(tag, w) from (
          select l as tag, sum(1.0 / cardinality(likes)) as w from public.preferences, unnest(likes) l
           where room_id = r.id group by l) t), '{}'::jsonb)),
    'candidates', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'source', c.source, 'placeId', c.place_id, 'name', c.name,
               'address', c.address, 'walkMinutes', c.walk_minutes, 'tags', c.tags, 'priceHint', c.price_hint,
               'priceType', c.price_type, 'addedBy', c.added_by) order by c.created_at)
      from public.candidates c where c.room_id = r.id), '[]'::jsonb),
    'votes', coalesce((
      select jsonb_object_agg(candidate_id, cnt) from (
        select candidate_id, count(*) cnt from public.votes where room_id = r.id group by candidate_id) t), '{}'::jsonb),
    'myVote', (select candidate_id from public.votes where room_id = r.id and participant_id = pt.id)
  );
end $$;

-- 만료 방 정리(하루 1회). Supabase pg_cron을 켠 경우:
--   select cron.schedule('purge-expired-rooms', '30 15 * * *', $$select public.purge_expired_rooms()$$);  -- 00:30 KST
create or replace function public.purge_expired_rooms() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.rooms where expires_at <= now();
  get diagnostics n = row_count;
  delete from public.join_code_attempts where attempted_at < now() - interval '1 day';
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- 권한: 내부 도우미·정리 함수는 anon 실행 금지, 공개 RPC만 허용
-- ---------------------------------------------------------------------------
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.create_room(text, text, text, text, text, int, int, text, text, text),
  public.join_room(text, text, text, text),
  public.join_room_by_code(text, text, text, text),
  public.save_preference(uuid, uuid, text, int, text[], text[], int),
  public.add_candidate(uuid, uuid, text, text, text, text, text, int, text[], int),
  public.cast_vote(uuid, uuid, text, uuid),
  public.set_room_status(uuid, uuid, text, text, uuid),
  public.get_room_state(uuid, uuid, text)
to anon, authenticated;
