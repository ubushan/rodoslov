import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TreeNotFound() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-5 py-16 text-center">
      <span className="studio-chip">Древо</span>
      <h1 className="mt-5 font-display text-[26px] leading-tight text-ink-800">
        Древо недоступно
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
        Такого древа нет или вас из него исключили. Попросите владельца прислать новую
        ссылку-приглашение.
      </p>
      <Link href="/dashboard" className="mt-7 w-full sm:w-auto">
        <Button size="lg" className="w-full sm:w-auto">
          К списку древ
        </Button>
      </Link>
    </div>
  );
}
