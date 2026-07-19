-- Living Calendar — Supabase 마이그레이션 (2인 홈 보드)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 1회 실행.
--
-- 주의: settings(실제 이름·스케줄 들어있음) 와 checks 는 건드리지 않는다.
-- txs 만 현재 앱 모델로 재생성한다. 옛 txs 는 id 가 uuid·type 컬럼 없음(옛 설계),
-- 데이터도 비어있어 안전. 현재 앱은 id=text, type='out'|'in' 을 쓴다.

drop table if exists txs cascade;

create table txs (
  id         text primary key,              -- 클라이언트 생성(Date+random)
  date       text not null,                 -- 'YYYY-MM-DD'
  amount     numeric not null,              -- 항상 양수, 방향은 type 으로
  type       text not null default 'out',   -- 'out'(지출) | 'in'(입금)
  memo       text default '',
  created_at timestamptz default now()
);

alter table txs enable row level security;
create policy anon_all on txs for all using (true) with check (true);

-- 참고: settings/checks 에 아직 anon 정책이 없다면 아래도 함께 실행.
-- (이미 동작 확인됨 — 없을 때만 필요)
-- create policy anon_all on settings for all using (true) with check (true);
-- create policy anon_all on checks   for all using (true) with check (true);
