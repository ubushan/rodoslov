import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Активная точка входа middleware. Приложение живёт в `src/app`, поэтому
 * Next.js читает middleware только отсюда; одноимённый файл в корне проекта
 * остаётся как справка и в этой сборке не используется.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
