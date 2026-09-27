import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TreeCanvas } from "@/components/tree/TreeCanvas";
import { familyBranch } from "@/lib/branch";
import { shortName } from "@/lib/format";
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

  return { title: data ? `Ветка ${shortName(data)} — Родослов` : "Ветка — Родослов" };
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mist-200 bg-white px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/tree/${treeId}`}
            className="rounded-lg px-2 py-1 text-sm text-ink-400 hover:bg-mist-100 hover:text-ink-700"
          >
            ← Всё древо
          </Link>
          <span className="text-mist-300">/</span>
          <h1 className="truncate font-display text-[17px] text-ink-800">
            Ветка: {shortName(person)}
          </h1>
          <span className="shrink-0 rounded-lg bg-mist-100 px-2 py-0.5 text-xs text-ink-500">
            {branchPersons.length} человек
          </span>
        </div>

        <Link
          href={`/tree/${treeId}/person/${personId}`}
          className="rounded-lg border border-mist-300 px-3 py-1.5 text-sm text-ink-700 transition-colors hover:border-ink-300"
        >
          Карточка родоначальника ветки
        </Link>
      </div>

      <div className="min-h-0 flex-1">
        <TreeCanvas
          treeId={treeId}
          treeTitle={`Ветка: ${shortName(person)}`}
          role={membership.role as MemberRole}
          persons={branchPersons}
          relationships={branchRelationships}
          attachments={(attachments ?? []) as Attachment[]}
          persistLayout={false}
        />
      </div>
    </div>
  );
}
