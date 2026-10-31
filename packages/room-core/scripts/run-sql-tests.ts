// Supabase 없이 마이그레이션과 RLS 테스트를 실제 Postgres(PGlite, WASM)로 실행한다.
// Supabase 기본 환경 중 필요한 것만 흉내 낸다: anon·authenticated 역할, extensions 스키마, 테이블 기본 권한.
// 사용: npm run test:sql --workspace packages/room-core
// 한계: Supabase의 실제 기본 권한·PostgREST·pg_cron은 재현하지 않는다 → 실제 프로젝트에서 한 번 더 실행(docs/TESTING.md).
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const ROOT = resolve(import.meta.dirname, '..', 'supabase');
const db = new PGlite({ extensions: { pgcrypto } });

await db.exec(`
  create schema if not exists extensions;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  grant usage on schema extensions to anon, authenticated;
  -- Supabase처럼 anon에게 테이블 권한을 기본으로 준다(RLS가 막아야 한다)
  alter default privileges in schema public grant all on tables to anon, authenticated;
`);

for (const f of readdirSync(join(ROOT, 'migrations')).sort()) {
  await db.exec(readFileSync(join(ROOT, 'migrations', f), 'utf8'));
  console.log(`✓ migration ${f}`);
}

const test = readFileSync(join(ROOT, 'tests', 'rls_test.sql'), 'utf8');
const results = await db.exec(test);
const last = results.filter((r) => r.rows.length).at(-1)?.rows[0];
console.log('result:', last);
if (!last || Object.values(last)[0] !== 'RLS OK') {
  console.error('✗ RLS test did not finish');
  process.exit(1);
}
console.log('✓ RLS OK');
