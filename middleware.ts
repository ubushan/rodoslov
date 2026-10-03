import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * ВНИМАНИЕ: приложение живёт в `src/app`, поэтому Next.js читает middleware
 * только из `src/middleware.ts` — этот файл в сборке не используется и оставлен
 * как справка. Логика — в `src/lib/supabase/middleware.ts` (общий модуль),
 * активная точка входа — `src/middleware.ts`.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
