import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PersonPage, type NewRelation } from "@/components/person/PersonPage";
import { shortName } from "@/lib/format";
import type { Person, Relationship, Attachment, MemberRole } from "@/lib/types";

type Params = { params: Promise<{ treeId: string; personId: string }> };
type Search = { searchParams: Promise<{ relateTo?: string; relation?: string }> };

export async function generateMetadata({ params }: Params) {
  const { treeId, personId } = await params;
  if (personId === "new") return { title: "Новая карточка — Родослов" };

  const supabase = await createClient();
  const { data } = await supabase
    .from("persons")
    .select("first_name, last_name, maiden_name, tree_id")
    .eq("id", personId)
    .eq("tree_id", treeId)
    .maybeSingle();

  return { title: data ? `${shortName(data)} — Родослов` : "Карточка — Родослов" };
}

export default async function PersonCardPage({ params, searchParams }: Params & Search) {
  const { treeId, personId } = await params;
  const { relateTo, relation } = await searchParams;
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

  const isNew = personId === "new";

  const [{ data: persons }, { data: relationships }, { data: attachments }, { error: deathPlaceError }] =
    await Promise.all([
      supabase.from("persons").select("*").eq("tree_id", treeId),
      supabase.from("relationships").select("*").eq("tree_id", treeId),
      supabase.from("person_attachments").select("*").eq("tree_id", treeId),
      // колонка места смерти может быть ещё не добавлена в базу — тогда прячем поле
      supabase.from("persons").select("death_place").limit(0),
    ]);

  const person = isNew ? null : ((persons ?? []) as Person[]).find((p) => p.id === personId);
  if (!isNew && !person) notFound();

  const relationKinds: NewRelation[] = ["child", "spouse", "father", "mother"];
  const kind = relationKinds.includes(relation as NewRelation) ? (relation as NewRelation) : null;

  return (
    <PersonPage
      treeId={treeId}
      treeTitle={tree.title}
      role={membership.role as MemberRole}
      person={person ?? null}
      persons={(persons ?? []) as Person[]}
      relationships={(relationships ?? []) as Relationship[]}
      attachments={((attachments ?? []) as Attachment[]).filter((a) => a.person_id === person?.id)}
      hasDeathPlace={!deathPlaceError}
      relation={relateTo && kind ? { relateTo, kind } : null}
    />
  );
}
