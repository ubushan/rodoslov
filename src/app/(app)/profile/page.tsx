import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "./form";

export const metadata = { title: "Профиль — Родослов" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single();

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-10 sm:py-14">
      <h1 className="text-[30px] leading-tight text-ink-800">Профиль</h1>
      <p className="mt-1.5 text-sm text-ink-500">
        Это имя видят родственники в списке участников древа.
      </p>

      <div className="mt-8 rounded-2xl border border-mist-200 bg-surface p-6">
        <ProfileForm fullName={profile?.full_name ?? ""} email={user!.email ?? ""} />
      </div>

      <form action={signOut} className="mt-8">
        <Button variant="secondary">Выйти из аккаунта</Button>
      </form>
    </div>
  );
}
