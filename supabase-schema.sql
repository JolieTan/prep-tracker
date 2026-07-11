-- 在 Supabase 项目的 SQL Editor 里粘贴并运行这段脚本

create table if not exists kv_store (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table kv_store enable row level security;

create policy "select own data" on kv_store
  for select using (auth.uid() = user_id);

create policy "insert own data" on kv_store
  for insert with check (auth.uid() = user_id);

create policy "update own data" on kv_store
  for update using (auth.uid() = user_id);

create policy "delete own data" on kv_store
  for delete using (auth.uid() = user_id);
