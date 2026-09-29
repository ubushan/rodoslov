-- =====================================================================
-- Родослов — история изменений карточки человека
-- Выполнить в Supabase → SQL Editor после schema.sql.
-- Требует колонку persons.death_place (она уже есть в schema.sql).
-- =====================================================================

create table if not exists public.person_changes (
  id         bigint generated always as identity primary key,
  tree_id    uuid not null references public.trees(id) on delete cascade,
  person_id  uuid not null references public.persons(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  before     jsonb,          -- снимок до правки; null у записи о создании
  after      jsonb not null, -- снимок после правки
  created_at timestamptz not null default now()
);

create index if not exists person_changes_person_idx on public.person_changes(person_id);

alter table public.person_changes enable row level security;

drop policy if exists person_changes_read on public.person_changes;
create policy person_changes_read on public.person_changes for select
  using (public.is_tree_member(tree_id));

-- Пишет снимок при каждой правке содержимого карточки. Перемещения карточки
-- (pos_x/pos_y) и смена портрета в историю не попадают.
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
