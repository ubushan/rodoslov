-- =====================================================================
-- Родослов — история изменений древа
-- Выполнить в Supabase → SQL Editor после schema.sql и person-history.sql.
-- Пишет события по карточкам, связям, участникам, приглашениям и древу.
-- Требует колонку persons.death_place (она есть в schema.sql).
-- =====================================================================

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
