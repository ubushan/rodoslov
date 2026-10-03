import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Админку тоже закрываем: анонимного гостя отправляем на вход, а вошедшего
// не-администратора уже не пустит её собственный layout
const PROTECTED = ["/dashboard", "/tree", "/profile", "/admin"];

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Шапка живёт в серверном layout и не знает адрес запроса. Пробрасываем путь
  // заголовком: layout читает его через headers() и, если это /tree/<id>,
  // достаёт название древа, роль и участников под сессией пользователя.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", path);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && PROTECTED.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // тот же путь в ответе — удобно проверять в браузере и в тестах
  response.headers.set("x-pathname", path);
  return response;
}
