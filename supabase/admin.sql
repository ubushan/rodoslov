-- =====================================================================
-- Родослов — администрирование платформы
-- Выполнить в Supabase → SQL Editor после schema.sql (целиком, один раз).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Администраторы платформы.
-- Панель читает и меняет эту таблицу только с сервера, через service role key,
-- поэтому политик доступа нет: обычным пользователям таблица не видна.
-- Кроме неё администраторов можно перечислить в переменной окружения ADMIN_EMAILS
-- (список через запятую) — это запасной вход, чтобы не потерять доступ.
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- ---------------------------------------------------------------------
-- Настройки платформы: пары «ключ — значение».
--   allow_signups        — открыта ли регистрация новых пользователей;
--   max_persons_per_tree — предел числа людей в одном древе, 0 — без предела.
-- Читают все, меняет только панель администратора (через service role).
-- ---------------------------------------------------------------------
create table if not exists public.platform_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (key, value) values
  ('allow_signups', 'true'::jsonb),
  ('max_persons_per_tree', '0'::jsonb)
on conflict (key) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists settings_read on public.platform_settings;
create policy settings_read on public.platform_settings for select using (true);

-- ---------------------------------------------------------------------
-- Первый администратор: подставьте свою почту, раскомментируйте и выполните.
-- Дальше администраторов можно назначать прямо в панели.
-- ---------------------------------------------------------------------
-- insert into public.admins (user_id, note)
-- select u.id, 'первый администратор'
-- from auth.users u
-- where u.email = 'you@example.com'
-- on conflict (user_id) do nothing;
