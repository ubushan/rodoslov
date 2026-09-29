import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/format";
import { NewTreeForm } from "./new-tree-form";

export const metadata = { title: "Мои древа — Родослов" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("tree_members")
    .select("role, tree_id, trees(id, title, description, updated_at, owner_id)")
    .order("created_at", { ascending: false });

  const rows = (memberships ?? []).filter((m) => m.trees) as unknown as Array<{
    role: string;
    trees: { id: string; title: string; description: string | null; updated_at: string; owner_id: string };
  }>;

  const counts = await Promise.all(
    rows.map(async (r) => {
      const { count } = await supabase
        .from("persons")
        .select("id", { count: "exact", head: true })
        .eq("tree_id", r.trees.id);
      return count ?? 0;
    })
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] leading-tight text-ink-800">Мои древа</h1>
          <p className="mt-1.5 text-sm text-ink-500">
            Здесь и те древа, что вы завели сами, и те, куда вас пригласили.
          </p>
        </div>
        <NewTreeForm />
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-mist-300 bg-surface px-6 py-16 text-center">
          <h2 className="text-[21px] text-ink-800">Пока ни одного древа</h2>
          <p className="mx-auto mt-2 max-w-[46ch] text-[15px] leading-relaxed text-ink-500">
            Начните с себя: создайте древо, добавьте свою карточку и пришлите ссылку
            родственникам — дальше заполните вместе.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {rows.map((r, i) => (
            <li key={r.trees.id}>
              <Link
                href={`/tree/${r.trees.id}`}
                className="group flex h-full flex-col rounded-2xl border border-mist-200 bg-surface p-5 transition-colors hover:border-ink-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-[19px] leading-snug text-ink-800">
                    {r.trees.title}
                  </h2>
                  <span className="shrink-0 rounded-lg bg-mist-100 px-2 py-0.5 text-xs text-ink-500">
                    {ROLE_LABEL[r.role]}
                  </span>
                </div>

                {r.trees.description && (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-500">
                    {r.trees.description}
                  </p>
                )}

                <p className="mt-auto pt-5 text-[13px] text-ink-400">
                  {counts[i]} {plural(counts[i], "человек", "человека", "человек")} в древе
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
