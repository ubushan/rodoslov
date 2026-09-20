import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TreeNotFound() {
  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <h1 className="text-[26px] text-ink-800">Древо недоступно</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
        Такого древа нет или вас из него исключили. Попросите владельца прислать новую
        ссылку-приглашение.
      </p>
      <Link href="/dashboard" className="mt-7 inline-block">
        <Button>К списку древ</Button>
      </Link>
    </div>
  );
}
