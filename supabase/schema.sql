-- =====================================================================
-- Родослов — схема базы данных
-- Выполнить в Supabase → SQL Editor (целиком, один раз).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Перечисления
-- ---------------------------------------------------------------------
do $$ begin
  create type member_role as enum ('owner', 'editor', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type relation_kind as enum ('parent', 'spouse');
exception when duplicate_object then null; end $$;

do $$ begin
  create type person_gender as enum ('male', 'female', 'unknown');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Профили пользователей
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Древа и участники
-- ---------------------------------------------------------------------
create table if not exists public.trees (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.tree_members (
  tree_id    uuid not null references public.trees(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (tree_id, user_id)
);

create index if not exists tree_members_user_idx on public.tree_members(user_id);

-- Владелец автоматически становится участником с ролью owner
create or replace function public.handle_new_tree()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.tree_members (tree_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_tree_created on public.trees;
create trigger on_tree_created
  after insert on public.trees
  for each row execute function public.handle_new_tree();

-- ---------------------------------------------------------------------
-- Ссылки-приглашения
-- ---------------------------------------------------------------------
create table if not exists public.tree_invites (
  id          uuid primary key default gen_random_uuid(),
  tree_id     uuid not null references public.trees(id) on delete cascade,
  token       text not null unique default encode(gen_random_bytes(16), 'hex'),
  role        member_role not null default 'editor',
  created_by  uuid not null references public.profiles(id) on delete cascade,
  expires_at  timestamptz,
  max_uses    int,
  uses        int not null default 0,
  revoked     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists tree_invites_tree_idx on public.tree_invites(tree_id);

-- ---------------------------------------------------------------------
-- Люди
-- ---------------------------------------------------------------------
create table if not exists public.persons (
  id           uuid primary key default gen_random_uuid(),
  tree_id      uuid not null references public.trees(id) on delete cascade,
  last_name    text not null default '',
  first_name   text not null default '',
  middle_name  text not null default '',
  maiden_name  text,
  other_names  text,
  gender       person_gender not null default 'unknown',
  birth_year   int,
  birth_date   date,
  birth_place  text,
  residence    text,
  is_living    boolean not null default true,
  death_year   int,
  death_date   date,
  death_place  text,
  bio          text,
  photo_path   text,
  pos_x        double precision not null default 0,
  pos_y        double precision not null default 0,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists persons_tree_idx on public.persons(tree_id);

-- ---------------------------------------------------------------------
-- Связи. parent: from_person — родитель, to_person — ребёнок.
--        spouse: пара, порядок не важен.
-- ---------------------------------------------------------------------
create table if not exists public.relationships (
  id             uuid primary key default gen_random_uuid(),
  tree_id        uuid not null references public.trees(id) on delete cascade,
  kind           relation_kind not null,
  from_person_id uuid not null references public.persons(id) on delete cascade,
  to_person_id   uuid not null references public.persons(id) on delete cascade,
  note           text,
  created_at     timestamptz not null default now(),
  constraint no_self_relation check (from_person_id <> to_person_id),
  unique (kind, from_person_id, to_person_id)
);

create index if not exists relationships_tree_idx on public.relationships(tree_id);

-- ---------------------------------------------------------------------
-- Архив: документы и дополнительные фотографии
-- ---------------------------------------------------------------------
create table if not exists public.person_attachments (
  id         uuid primary key default gen_random_uuid(),
  tree_id    uuid not null references public.trees(id) on delete cascade,
  person_id  uuid not null references public.persons(id) on delete cascade,
  storage_path text not null,
  caption    text,
  kind       text not null default 'photo',  -- photo | document
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists attachments_person_idx on public.person_attachments(person_id);

-- ---------------------------------------------------------------------
-- Вспомогательные функции доступа (security definer — чтобы RLS не зациклилась)
-- ---------------------------------------------------------------------
create or replace function public.tree_role(p_tree uuid)
returns member_role language sql stable security definer set search_path = public as $$
  select role from public.tree_members where tree_id = p_tree and user_id = auth.uid();
$$;

create or replace function public.is_tree_member(p_tree uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tree_members where tree_id = p_tree and user_id = auth.uid());
$$;

create or replace function public.can_edit_tree(p_tree uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.tree_role(p_tree) in ('owner', 'editor');
$$;

create or replace function public.is_tree_owner(p_tree uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.tree_role(p_tree) = 'owner';
$$;

-- Присоединение по ссылке-приглашению
create or replace function public.accept_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  inv public.tree_invites;
begin
  select * into inv from public.tree_invites where token = p_token;

  if inv.id is null then raise exception 'INVITE_NOT_FOUND'; end if;
  if inv.revoked then raise exception 'INVITE_REVOKED'; end if;
  if inv.expires_at is not null and inv.expires_at < now() then raise exception 'INVITE_EXPIRED'; end if;
  if inv.max_uses is not null and inv.uses >= inv.max_uses then raise exception 'INVITE_EXHAUSTED'; end if;
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;

  insert into public.tree_members (tree_id, user_id, role)
  values (inv.tree_id, auth.uid(), inv.role)
  on conflict (tree_id, user_id) do nothing;

  update public.tree_invites set uses = uses + 1 where id = inv.id;
  return inv.tree_id;
end $$;

-- Превью приглашения до входа в аккаунт
create or replace function public.invite_preview(p_token text)
returns table (tree_title text, role member_role, valid boolean)
language sql stable security definer set search_path = public as $$
  select t.title, i.role,
         (not i.revoked
          and (i.expires_at is null or i.expires_at > now())
          and (i.max_uses is null or i.uses < i.max_uses))
  from public.tree_invites i
  join public.trees t on t.id = i.tree_id
  where i.token = p_token;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.trees              enable row level security;
alter table public.tree_members       enable row level security;
alter table public.tree_invites       enable row level security;
alter table public.persons            enable row level security;
alter table public.relationships      enable row level security;
alter table public.person_attachments enable row level security;

-- profiles
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select
  using (true);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- trees
drop policy if exists trees_read on public.trees;
-- owner_id проверяется отдельно: при insert ... returning членство ещё не видно,
-- потому что строка в tree_members создаётся триггером on_tree_created в том же операторе
create policy trees_read on public.trees for select
  using (owner_id = auth.uid() or public.is_tree_member(id));

drop policy if exists trees_insert on public.trees;
create policy trees_insert on public.trees for insert
  with check (owner_id = auth.uid());

drop policy if exists trees_update on public.trees;
create policy trees_update on public.trees for update
  using (public.can_edit_tree(id)) with check (public.can_edit_tree(id));

drop policy if exists trees_delete on public.trees;
create policy trees_delete on public.trees for delete
  using (owner_id = auth.uid());

-- tree_members
drop policy if exists members_read on public.tree_members;
create policy members_read on public.tree_members for select
  using (public.is_tree_member(tree_id));

drop policy if exists members_write on public.tree_members;
create policy members_write on public.tree_members for all
  using (public.is_tree_owner(tree_id)) with check (public.is_tree_owner(tree_id));

drop policy if exists members_leave on public.tree_members;
create policy members_leave on public.tree_members for delete
  using (user_id = auth.uid() and role <> 'owner');

-- tree_invites
drop policy if exists invites_read on public.tree_invites;
create policy invites_read on public.tree_invites for select
  using (public.is_tree_owner(tree_id));

drop policy if exists invites_write on public.tree_invites;
create policy invites_write on public.tree_invites for all
  using (public.is_tree_owner(tree_id)) with check (public.is_tree_owner(tree_id));

-- persons
drop policy if exists persons_read on public.persons;
create policy persons_read on public.persons for select
  using (public.is_tree_member(tree_id));

drop policy if exists persons_write on public.persons;
create policy persons_write on public.persons for all
  using (public.can_edit_tree(tree_id)) with check (public.can_edit_tree(tree_id));

-- relationships
drop policy if exists rel_read on public.relationships;
create policy rel_read on public.relationships for select
  using (public.is_tree_member(tree_id));

drop policy if exists rel_write on public.relationships;
create policy rel_write on public.relationships for all
  using (public.can_edit_tree(tree_id)) with check (public.can_edit_tree(tree_id));

-- person_attachments
drop policy if exists att_read on public.person_attachments;
create policy att_read on public.person_attachments for select
  using (public.is_tree_member(tree_id));

drop policy if exists att_write on public.person_attachments;
create policy att_write on public.person_attachments for all
  using (public.can_edit_tree(tree_id)) with check (public.can_edit_tree(tree_id));

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists persons_touch on public.persons;
create trigger persons_touch before update on public.persons
  for each row execute function public.touch_updated_at();

drop trigger if exists trees_touch on public.trees;
create trigger trees_touch before update on public.trees
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Realtime — чтобы правки родственников появлялись у всех
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.persons;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.relationships;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.tree_members;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Хранилище файлов
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('archive', 'archive', true)
on conflict (id) do nothing;

-- Путь к файлу: {tree_id}/{person_id}/{filename}
drop policy if exists storage_read on storage.objects;
create policy storage_read on storage.objects for select
  using (bucket_id in ('photos', 'archive'));

drop policy if exists storage_upload on storage.objects;
create policy storage_upload on storage.objects for insert
  with check (
    bucket_id in ('photos', 'archive')
    and public.can_edit_tree((storage.foldername(name))[1]::uuid)
  );

drop policy if exists storage_delete on storage.objects;
create policy storage_delete on storage.objects for delete
  using (
    bucket_id in ('photos', 'archive')
    and public.can_edit_tree((storage.foldername(name))[1]::uuid)
  );

-- ---------------------------------------------------------------------
-- История изменений карточки человека (кто, когда и что поменял)
-- ---------------------------------------------------------------------
create table if not exists public.person_changes (
  id         bigint generated always as identity primary key,
  tree_id    uuid not null references public.trees(id) on delete cascade,
  person_id  uuid not null references public.persons(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  before     jsonb,
  after      jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists person_changes_person_idx on public.person_changes(person_id);

alter table public.person_changes enable row level security;

drop policy if exists person_changes_read on public.person_changes;
create policy person_changes_read on public.person_changes for select
  using (public.is_tree_member(tree_id));

create or replace function public.track_person_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  omit   text[] := array['id', 'tree_id', 'photo_path', 'pos_x', 'pos_y', 'created_by', 'created_at', 'updated_at'];
  before jsonb;
  after  jsonb;
begin
  after := to_jsonb(new) - omit;
  if tg_op = 'INSERT' then
    insert into public.person_changes (tree_id, person_id, changed_by, before, after)
    values (new.tree_id, new.id, auth.uid(), null, after);
    return new;
  end if;

  before := to_jsonb(old) - omit;
  if before is distinct from after then
    insert into public.person_changes (tree_id, person_id, changed_by, before, after)
    values (new.tree_id, new.id, auth.uid(), before, after);
  end if;
  return new;
end $$;

drop trigger if exists on_person_change on public.persons;
create trigger on_person_change
  after insert or update on public.persons
  for each row execute function public.track_person_change();

-- ---------------------------------------------------------------------
-- История изменений древа (см. также supabase/tree-history.sql)
-- ---------------------------------------------------------------------


create table if not exists public.tree_events (
  id         bigint generated always as identity primary key,
  tree_id    uuid not null references public.trees(id) on delete cascade,
  actor      uuid references public.profiles(id) on delete set null,
  kind       text not null,   -- person_created | person_updated | person_deleted | relation_added |
                              -- relation_removed | tree_renamed | member_added | member_role |
                              -- member_removed | invite_created | invite_revoked | import
  summary    text not null,   -- готовая фраза для списка
  details    jsonb,           -- снимки «до» и «после» или дополнительные сведения
  created_at timestamptz not null default now()
);

create index if not exists tree_events_tree_idx on public.tree_events(tree_id, created_at desc);

alter table public.tree_events enable row level security;

drop policy if exists tree_events_read on public.tree_events;
create policy tree_events_read on public.tree_events for select
  using (public.is_tree_member(tree_id));

-- ---------------------------------------------------------------------
-- Карточки людей
-- ---------------------------------------------------------------------
create or replace function public.log_person_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  omit text[] := array['id', 'tree_id', 'photo_path', 'pos_x', 'pos_y', 'created_by', 'created_at', 'updated_at'];
begin
  if tg_op = 'DELETE' then
    -- при удалении древа целиком каскад убирает и людей: событие уже не нужно,
    -- а сослаться на удалённое древо нельзя — вставка упала бы по внешнему ключу
    if not exists (select 1 from public.trees where id = old.tree_id) then
      return old;
    end if;
    insert into public.tree_events (tree_id, actor, kind, summary, details)
    values (old.tree_id, auth.uid(), 'person_deleted',
            format('Удалил карточку «%s»', trim(concat_ws(' ', old.first_name, old.last_name))),
            jsonb_build_object('before', to_jsonb(old) - omit));
    return old;
  end if;

  if tg_op = 'INSERT' then
    insert into public.tree_events (tree_id, actor, kind, summary, details)
    values (new.tree_id, auth.uid(), 'person_created',
            format('Добавил карточку «%s»', trim(concat_ws(' ', new.first_name, new.last_name))),
            jsonb_build_object('after', to_jsonb(new) - omit));
    return new;
  end if;

  if (to_jsonb(old) - omit) is distinct from (to_jsonb(new) - omit) then
    insert into public.tree_events (tree_id, actor, kind, summary, details)
    values (new.tree_id, auth.uid(), 'person_updated',
            format('Изменил карточку «%s»', trim(concat_ws(' ', new.first_name, new.last_name))),
            jsonb_build_object('before', to_jsonb(old) - omit, 'after', to_jsonb(new) - omit));
  end if;
  return new;
end $$;

drop trigger if exists on_person_event on public.persons;
create trigger on_person_event
  after insert or update or delete on public.persons
  for each row execute function public.log_person_event();

-- ---------------------------------------------------------------------
-- Связи
-- ---------------------------------------------------------------------
create or replace function public.log_relation_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a text;
  b text;
begin
  if tg_op = 'DELETE' then
    -- при удалении древа целиком каскад убирает и людей: событие уже не нужно,
    -- а сослаться на удалённое древо нельзя — вставка упала бы по внешнему ключу
    if not exists (select 1 from public.trees where id = old.tree_id) then
      return old;
    end if;
    select trim(concat_ws(' ', first_name, last_name)) into a from public.persons where id = old.from_person_id;
    select trim(concat_ws(' ', first_name, last_name)) into b from public.persons where id = old.to_person_id;
    insert into public.tree_events (tree_id, actor, kind, summary)
    values (old.tree_id, auth.uid(), 'relation_removed',
            case when old.kind = 'spouse'
                 then format('Разорвал связь супругов: %s и %s', coalesce(a, '?'), coalesce(b, '?'))
                 else format('Разорвал связь: %s — родитель %s', coalesce(a, '?'), coalesce(b, '?'))
            end);
    return old;
  end if;

  select trim(concat_ws(' ', first_name, last_name)) into a from public.persons where id = new.from_person_id;
  select trim(concat_ws(' ', first_name, last_name)) into b from public.persons where id = new.to_person_id;
  insert into public.tree_events (tree_id, actor, kind, summary)
  values (new.tree_id, auth.uid(), 'relation_added',
          case when new.kind = 'spouse'
               then format('Связал супругов: %s и %s', coalesce(a, '?'), coalesce(b, '?'))
               else format('Связал: %s — родитель %s', coalesce(a, '?'), coalesce(b, '?'))
          end);
  return new;
end $$;

drop trigger if exists on_relation_event on public.relationships;
create trigger on_relation_event
  after insert or delete on public.relationships
  for each row execute function public.log_relation_event();

-- ---------------------------------------------------------------------
-- Древо: создание и переименование
-- ---------------------------------------------------------------------
create or replace function public.log_tree_row_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.tree_events (tree_id, actor, kind, summary)
    values (new.id, auth.uid(), 'tree_created', format('Создал древо «%s»', new.title));
    return new;
  end if;

  if new.title is distinct from old.title then
    insert into public.tree_events (tree_id, actor, kind, summary, details)
    values (new.id, auth.uid(), 'tree_renamed',
            format('Переименовал древо: «%s» → «%s»', old.title, new.title),
            jsonb_build_object('before', old.title, 'after', new.title));
  end if;
  return new;
end $$;

drop trigger if exists on_tree_event on public.trees;
create trigger on_tree_event
  after insert or update on public.trees
  for each row execute function public.log_tree_row_event();

-- ---------------------------------------------------------------------
-- Участники
-- ---------------------------------------------------------------------
create or replace function public.log_member_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  who text;
  role_name text;
begin
  if tg_op = 'DELETE' then
    -- при удалении древа целиком каскад убирает и людей: событие уже не нужно,
    -- а сослаться на удалённое древо нельзя — вставка упала бы по внешнему ключу
    if not exists (select 1 from public.trees where id = old.tree_id) then
      return old;
    end if;
    select coalesce(full_name, 'Участник') into who from public.profiles where id = old.user_id;
    insert into public.tree_events (tree_id, actor, kind, summary)
    values (old.tree_id, auth.uid(), 'member_removed',
            case when auth.uid() = old.user_id
                 then format('%s покинул древо', who)
                 else format('Исключил участника: %s', who)
            end);
    return old;
  end if;

  select coalesce(full_name, 'Участник') into who from public.profiles where id = new.user_id;

  if tg_op = 'INSERT' then
    if new.role = 'owner' and auth.uid() = new.user_id then
      return new;  -- владелец появляется вместе с древом, отдельное событие лишнее
    end if;
    insert into public.tree_events (tree_id, actor, kind, summary)
    values (new.tree_id, auth.uid(), 'member_added', format('Добавил участника: %s', who));
    return new;
  end if;

  if new.role is distinct from old.role then
    role_name := case new.role when 'owner' then 'владелец' when 'editor' then 'редактор' else 'зритель' end;
    insert into public.tree_events (tree_id, actor, kind, summary)
    values (new.tree_id, auth.uid(), 'member_role',
            format('Сменил роль: %s — %s', who, role_name));
  end if;
  return new;
end $$;

drop trigger if exists on_member_event on public.tree_members;
create trigger on_member_event
  after insert or update or delete on public.tree_members
  for each row execute function public.log_member_event();

-- ---------------------------------------------------------------------
-- Приглашения
-- ---------------------------------------------------------------------
create or replace function public.log_invite_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.tree_events (tree_id, actor, kind, summary)
    values (new.tree_id, auth.uid(), 'invite_created', 'Создал ссылку-приглашение');
    return new;
  end if;

  if new.revoked and not old.revoked then
    insert into public.tree_events (tree_id, actor, kind, summary)
    values (new.tree_id, auth.uid(), 'invite_revoked', 'Отозвал ссылку-приглашение');
  end if;
  return new;
end $$;

drop trigger if exists on_invite_event on public.tree_invites;
create trigger on_invite_event
  after insert or update on public.tree_invites
  for each row execute function public.log_invite_event();

-- ---------------------------------------------------------------------
-- Своё событие из приложения: например сводка импорта GEDCOM.
-- Писать может только тот, кто вправе править древо.
-- ---------------------------------------------------------------------
create or replace function public.log_tree_event(p_tree uuid, p_kind text, p_summary text, p_details jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- именно is not true: tree_role для постороннего вернёт NULL, а «if not NULL» не сработает
  if public.can_edit_tree(p_tree) is not true then
    raise exception 'NOT_ALLOWED';
  end if;
  insert into public.tree_events (tree_id, actor, kind, summary, details)
  values (p_tree, auth.uid(), p_kind, p_summary, p_details);
end $$;

grant execute on function public.log_tree_event(uuid, text, text, jsonb) to authenticated;
