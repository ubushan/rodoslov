import Link from "next/link";
import { Section, Empty } from "@/components/admin/ui";
import { TreesTable, type TreeRow } from "@/components/admin/TreesTable";
import { adminClient, embeddedName, hasServiceKey, usersById, TREE_OWNER_SELECT } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Древа — Родослов" };

type Search = { searchParams: Promise<{ page?: string }> };
const PER_PAGE = 20;

export default async function AdminTreesPage({ searchParams }: Search) {
  const { page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw ?? 1) || 1);

  if (!hasServiceKey()) {
    return (
      <Section title="Древа">
        <Empty>Список всех древ доступен после подключения service role key (см. подсказку выше).</Empty>
      </Section>
    );
  }

  const admin = adminClient();
  const from = (page - 1) * PER_PAGE;

  const [treeList, members, persons] = await Promise.all([
    admin
      .from("trees")
      .select(`id, title, created_at, updated_at, owner_id, ${TREE_OWNER_SELECT}`, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + PER_PAGE - 1),
    admin.from("tree_members").select("tree_id"),
    admin.from("persons").select("tree_id"),
  ]);

  const tally = (rows: { tree_id: string }[] | null) => {
    const map = new Map<string, number>();
    for (const row of rows ?? []) map.set(row.tree_id, (map.get(row.tree_id) ?? 0) + 1);
    return map;
  };

  const membersByTree = tally(members.data as { tree_id: string }[] | null);
  const personsByTree = tally(persons.data as { tree_id: string }[] | null);
  const trees = treeList.data ?? [];
  const owners = await usersById(trees.map((tree) => tree.owner_id as string));

  const rows: TreeRow[] = trees.map((tree) => ({
    id: tree.id as string,
    title: tree.title as string,
    ownerName: embeddedName(tree.owner) ?? owners.get(tree.owner_id as string)?.name ?? "Без имени",
    ownerEmail: owners.get(tree.owner_id as string)?.email ?? null,
    members: membersByTree.get(tree.id as string) ?? 0,
    persons: personsByTree.get(tree.id as string) ?? 0,
    createdAt: formatDateTime(tree.created_at as string),
    updatedAt: formatDateTime(tree.updated_at as string),
  }));

  const total = treeList.count ?? rows.length;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-4">
      <Section title="Древа" hint={`Всего на платформе: ${total}.`}>
        {rows.length === 0 ? <Empty>Древ пока нет.</Empty> : <TreesTable rows={rows} />}
      </Section>

      {lastPage > 1 && (
        <div className="flex items-center justify-between text-[13px] text-ink-500">
          {page > 1 ? (
            <Link href={`/admin/trees?page=${page - 1}`} className="hover:text-ink-800">
              ← Предыдущая
            </Link>
          ) : (
            <span />
          )}
          <span>
            Страница {page} из {lastPage}
          </span>
          {page < lastPage ? (
            <Link href={`/admin/trees?page=${page + 1}`} className="hover:text-ink-800">
              Следующая →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
