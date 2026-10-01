import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Возврат после входа через Google или по ссылке из письма.
 *
 * Адрес для редиректа берём из NEXT_PUBLIC_SITE_URL: за обратным прокси
 * (nginx → 127.0.0.1:3000) request.url разрешается во внутренний адрес вида
 * localhost:3000, и человек после входа уехал бы в никуда.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // только свой путь: чужой адрес в next превратился бы в открытый редирект
  const requested = searchParams.get("next") ?? "/dashboard";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";
  const base = (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(/\/+$/, "");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${base}${next}`);
  }

  return NextResponse.redirect(`${base}/login?error=callback`);
}
