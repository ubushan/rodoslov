import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Chip,
  Empty,
  IconArchive,
  IconExternal,
  IconLink,
  IconMail,
  IconUser,
  IconUsers,
  Section,
  StatTile,
} from "@/components/admin/ui";
import { DeleteTreeButton, InvitesList, MembersList } from "@/components/admin/TreeAccess";
import { adminClient, embeddedName, hasServiceKey, usersById, TREE_OWNER_SELECT } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";

type Params = { params: Promise<{ treeId: string }> };

export async function generateMetadata({ params }: Params) {
  const { treeId } = await params;
  if (!hasServiceKey()) return { title: "Древо — Torlmud" };
  const { data } = await adminClient().from("trees").select("title").eq("id", treeId).maybeSingle();
  return { title: data ? `${data.title} — администрирование` : "Древо — Torlmud" };
}

export default async function AdminTreePage({ params }: Params) {
  const { treeId } = await params;
  if (!hasServiceKey()) notFound();

  const admin = adminClient();
  const head = { count: "exact" as const, head: true };

  const [treeResult, members, invites, personCount, relationCount, attachmentCount] = await Promise.all([
    admin.from("trees").select(`id, title, description, created_at, updated_at, owner_id, ${TREE_OWNER_SELECT}`).eq("id", treeId).maybeSingle(),
    admin.from("tree_members").select("user_id, role, created_at").eq("tree_id", treeId),
    admin.from("tree_invites").select("*").eq("tree_id", treeId).order("created_at", { ascending: false }),
    admin.from("persons").select("id", head).eq("tree_id", treeId),
    admin.from("relationships").select("id", head).eq("tree_id", treeId),
    admin.from("person_attachments").select("id", head).eq("tree_id", treeId),
  ]);

  const tree = treeResult.data;
  if (!tree) notFound();

  const ownerId = tree.owner_id as string;
  const people = await usersById([ownerId, ...(members.data ?? []).map((m) => m.user_id as string)]);
  const ownerName = embeddedName(tree.owner) ?? people.get(ownerId)?.name ?? "без имени";
  const ownerEmail = people.get(ownerId)?.email ?? null;

  const memberRows = (members.data ?? []).map((member) => ({
    userId: member.user_id as string,
    email: people.get(member.user_id as string)?.email ?? null,
    name: people.get(member.user_id as string)?.name ?? "Участник",
    role: member.role as string,
    isOwner: member.user_id === ownerId,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <Link href="/admin/trees" className="text-[12.5px] text-ink-400 transition-colors hover:text-ink-700">
            ← Все древа
          </Link>
          <h2 className="mt-1 font-display text-[22px] leading-tight text-ink-800">{tree.title}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12.5px] text-ink-500">
            <Chip tone="accent">владелец</Chip>
            <span className="text-ink-700">{ownerName}</span>
            {ownerEmail && <span className="[overflow-wrap:anywhere] text-ink-400">{ownerEmail}</span>}
            <span className="text-ink-300">
              создано {formatDateTime(tree.created_at as string)} · изменено{" "}
              {formatDateTime(tree.updated_at as string)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/tree/${treeId}`}
            className="inline-flex h-8 items-center gap-2 rounded-[10px] border border-[var(--p-line)] bg-surface px-3 text-[13px] text-ink-700 shadow-[var(--p-inset-hi)] transition-colors hover:border-[var(--p-line-3)] hover:bg-[var(--p-hover-bg)]"
          >
            <IconExternal size={15} />
            Открыть на холсте
          </Link>
          <DeleteTreeButton treeId={treeId} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Люди" value={personCount.count ?? 0} icon={<IconUser size={14} />} />
        <StatTile label="Связи" value={relationCount.count ?? 0} icon={<IconLink size={14} />} />
        <StatTile label="Файлы архива" value={attachmentCount.count ?? 0} icon={<IconArchive size={14} />} />
        <StatTile label="Участники" value={memberRows.length} icon={<IconUsers size={14} />} />
      </div>

      <Section title="Доступ" hint="Роль участника определяет, что он может делать в этом древе.">
        {memberRows.length === 0 ? (
          <Empty>У древа нет участников.</Empty>
        ) : (
          <MembersList treeId={treeId} members={memberRows} />
        )}
      </Section>

      <Section title="Приглашения" hint="Ссылки, по которым в древо добавляют новых участников.">
        {(invites.data ?? []).length === 0 ? (
          <Empty>Приглашений нет.</Empty>
        ) : (
          <InvitesList
            treeId={treeId}
            invites={(invites.data ?? []).map((invite) => ({
              id: invite.id as string,
              role: invite.role as string,
              token: invite.token as string,
              uses: invite.uses as number,
              maxUses: (invite.max_uses as number | null) ?? null,
              expiresAt: (invite.expires_at as string | null) ?? null,
              revoked: invite.revoked as boolean,
              createdAt: formatDateTime(invite.created_at as string),
            }))}
          />
        )}
      </Section>
    </div>
  );
}
