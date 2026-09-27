"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; notice?: string } | null;

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        error:
          "Почта ещё не подтверждена. Перейдите по ссылке из письма, которое мы отправили при регистрации.",
      };
    }
    if (error.code === "over_request_rate_limit") {
      return { error: "Слишком много попыток входа. Подождите минуту и попробуйте снова." };
    }
    return { error: "Не удалось войти. Проверьте почту и пароль." };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (password.length < 8) {
    return { error: "Пароль должен быть не короче 8 символов." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    switch (error.code) {
      case "user_already_exists":
      case "email_exists":
        return { error: "Этот адрес уже зарегистрирован. Войдите вместо регистрации." };
      // Supabase отбрасывает адреса на доменах без почты — например, example.com
      // из подсказки в поле. Без этой ветки ошибка выглядела бы как сбой сервиса.
      case "email_address_invalid":
      case "email_address_not_authorized":
        return { error: "Проверьте адрес почты: похоже, в нём опечатка." };
      case "over_email_send_rate_limit":
      case "over_request_rate_limit":
        return {
          error:
            "Слишком много писем за короткое время. Подождите час — или войдите, если аккаунт уже создан.",
        };
      case "email_provider_disabled":
      case "signup_disabled":
        return { error: "Регистрация по почте сейчас недоступна." };
      default:
        return { error: "Не удалось создать аккаунт. Попробуйте ещё раз." };
    }
  }

  // Подтверждение почты включено: аккаунт создан, но сессии ещё нет.
  // Пользователь, который уже подтверждал адрес, приходит с пустым списком identities —
  // так Supabase скрывает существующие аккаунты от перебора.
  if (!data.session) {
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { error: "Этот адрес уже зарегистрирован. Войдите вместо регистрации." };
    }
    return {
      notice: `Аккаунт создан. Мы отправили письмо на ${email} — перейдите по ссылке из него, чтобы завершить регистрацию.`,
    };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signInWithGoogle(formData: FormData) {
  const next = String(formData.get("next") ?? "/dashboard");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateProfile(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);

  if (error) return { error: "Не удалось сохранить имя." };

  revalidatePath("/profile");
  return null;
}
