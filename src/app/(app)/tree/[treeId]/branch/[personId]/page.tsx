import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TreeCanvas } from "@/components/tree/TreeCanvas";
import { familyBranch } from "@/lib/branch";
import { peopleWord, shortName, initials, lifespan } from "@/lib/format";
import type { Person, Relationship, Attachment, MemberRole } from "@/lib/types";

type Params = { params: Promise<{ treeId: string; personId: string }> };

export async function generateMetadata({ params }: Params) {
  const { treeId, personId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("persons")
    .select("first_name, last_name, maiden_name, tree_id")
    .eq("id", personId)
    .eq("tree_id", treeId)
    .maybeSingle();

  return { title: data ? `Ветка ${shortName(data)} — Torlmud` : "Ветка — Torlmud" };
}

/** Инициалы в рамке по полу — как на странице человека. */
function Avatar({ person, className = "" }: { person: Person; className?: string }) {
  const tone =
    person.gender === "male"
      ? "border-male/50 bg-male-tint"
      : person.gender === "female"
        ? "border-female/50 bg-female-tint"
        : "border-line bg-mist-50";
  return (
    <span
      aria-hidden="true"
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border text-[11.5px] font-medium text-ink-600 ${tone} ${className}`}
    >
      {initials(person)}
    </span>
  );
}

export default async function BranchPage({ params }: Params) {
  const { treeId, personId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: tree }, { data: membership }] = await Promise.all([
    supabase.from("trees").select("id, title").eq("id", treeId).single(),
    supabase
      .from("tree_members")
      .select("role")
      .eq("tree_id", treeId)
      .eq("user_id", user!.id)
      .maybeSingle(),
  ]);

  if (!tree || !membership) notFound();

  const [{ data: persons }, { data: relationships }, { data: attachments }] = await Promise.all([
    supabase.from("persons").select("*").eq("tree_id", treeId),
    supabase.from("relationships").select("*").eq("tree_id", treeId),
    supabase.from("person_attachments").select("*").eq("tree_id", treeId),
  ]);

  const allPersons = (persons ?? []) as Person[];
  const allRelationships = (relationships ?? []) as Relationship[];
  const person = allPersons.find((p) => p.id === personId);
  if (!person) notFound();

  const branch = familyBranch(personId, allPersons, allRelationships);
  const branchPersons = allPersons.filter((p) => branch.has(p.id));
  const branchRelationships = allRelationships.filter(
    (r) => branch.has(r.from_person_id) && branch.has(r.to_person_id)
  );

  // состав ветки — по старшинству, без даты в конце; только для порядка карточек
  const branchPeople = [...branchPersons].sort((a, b) => {
    const key = (p: Person) => p.birth_date ?? (p.birth_year ? String(p.birth_year) : "9999");
    const ka = key(a);
    const kb = key(b);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return shortName(a).localeCompare(shortName(b), "ru");
  });

  const rootLife = lifespan(person);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-3 py-4 sm:px-4 sm:py-6">
        {/* Шапка ветки: та же логика, что у карточки человека */}
        <section className="panel p-4 sm:p-5">
          <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-400">
            <Link href="/dashboard" className="transition-colors hover:text-ink-700">
              Все древа
            </Link>
            <span aria-hidden="true" className="text-mist-300">/</span>
            <Link href={`/tree/${treeId}`} className="break-words transition-colors hover:text-ink-700">
              {tree.title}
            </Link>
            <span aria-hidden="true" className="text-mist-300">/</span>
            <span>Ветка</span>
          </nav>

          <div className="mt-1.5 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="break-words font-display text-[24px] leading-tight text-ink-800 sm:text-[28px]">
                Ветка: {shortName(person)}
              </h1>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <span className="studio-chip">
                  {branchPersons.length} {peopleWord(branchPersons.length)}
                </span>
                {rootLife && <span className="studio-chip">{rootLife}</span>}
                {person.birth_place && (
                  <span
                    className="studio-chip max-w-full"
                    style={{ height: "auto", minHeight: "26px", whiteSpace: "normal", padding: "3px 10px" }}
                  >
                    Рождение: {person.birth_place}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/tree/${treeId}`}
                className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink-700 shadow-[var(--p-inset-hi)] transition-colors hover:border-line-3 hover:bg-[var(--p-hover-bg)]"
              >
                ← Всё древо
              </Link>
              <Link href={`/tree/${treeId}/person/${personId}`} className="btn-accent">
                Карточка родоначальника
              </Link>
            </div>
          </div>
        </section>

        {/* Состав ветки: карточки на .panel, текущий человек выделен */}
        <section className="panel p-4 sm:p-5">
          <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="font-display text-[16px] text-ink-800">Состав ветки</h2>
            <span className="text-[12px] text-ink-400">
              Нажмите на карточку, чтобы открыть страницу человека
            </span>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {branchPeople.map((p) => {
              const isRoot = p.id === personId;
              const life = lifespan(p);
              return (
                <li key={p.id}>
                  <Link
                    href={`/tree/${treeId}/person/${p.id}`}
                    aria-current={isRoot ? "page" : undefined}
                    style={
                      isRoot
                        ? {
                            borderColor: "var(--color-brass-500)",
                            boxShadow:
                              "0 0 0 3px color-mix(in srgb, var(--color-brass-500) 24%, transparent), var(--shadow-lift)",
                          }
                        : undefined
                    }
                    className={`studio-card group flex items-center gap-2.5 p-2.5 transition-colors ${
                      p.gender === "male" ? "is-male" : p.gender === "female" ? "is-female" : ""
                    }`}
                  >
                    <Avatar person={p} />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-[13px] leading-snug text-ink-800 transition-colors group-hover:text-brass-600">
                        {shortName(p)}
                      </span>
                      <span className="mt-0.5 block break-words text-[11.5px] text-ink-400">
                        {life ?? "Годы неизвестны"}
                      </span>
                    </span>
                    {isRoot && (
                      <span
                        className="studio-chip shrink-0"
                        style={{
                          borderColor: "var(--p-acc-line)",
                          background: "var(--p-acc-bg)",
                          color: "var(--p-brass-ink)",
                        }}
                      >
                        Родоначальник
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Холст ветки — в рамке панели, как остальные поверхности студии */}
        <section className="panel relative h-[70vh] min-h-[420px] overflow-hidden">
          <TreeCanvas
            treeId={treeId}
            treeTitle={`Ветка: ${shortName(person)}`}
            role={membership.role as MemberRole}
            persons={branchPersons}
            relationships={branchRelationships}
            attachments={(attachments ?? []) as Attachment[]}
            persistLayout={false}
            wholeTreeHref={`/tree/${treeId}`}
            branchRoot={{ id: personId, hidden: allPersons.length - branchPersons.length }}
          />
        </section>
      </div>
    </div>
  );
}
