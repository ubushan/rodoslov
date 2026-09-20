"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { changeMemberRole } from "@/app/actions/members";
import { Select } from "@/components/ui/field";
import type { MemberRole } from "@/lib/types";

export function RoleSelect({
  treeId,
  userId,
  role,
}: {
  treeId: string;
  userId: string;
  role: MemberRole;
}) {
  const [pending, start] = useTransition();

  return (
    <Select
      aria-label="Роль участника"
      defaultValue={role}
      disabled={pending}
      className="h-9 w-[132px] py-0"
      onChange={(e) =>
        start(async () => {
          await changeMemberRole(treeId, userId, e.target.value as MemberRole);
          toast.success("Роль изменена");
        })
      }
    >
      <option value="editor">Редактор</option>
      <option value="viewer">Зритель</option>
    </Select>
  );
}
