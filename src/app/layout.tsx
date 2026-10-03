import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Literata, Golos_Text } from "next/font/google";
import { Toaster } from "sonner";
import { THEME_COOKIE, themeFromCookie } from "@/lib/theme";
import "./globals.css";

const literata = Literata({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-literata",
  display: "swap",
});

const golos = Golos_Text({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-golos",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Torlmud — семейное древо, которое собирают вместе",
  description:
    "Сервис для совместного составления родословной: карточки родственников, связи между поколениями, архив документов и экспорт древа в картинку.",
};

/**
 * Тема применяется до первой отрисовки: иначе при «как в системе» и после
 * выбора тёмной на долю секунды мелькала бы светлая страница.
 */
const THEME_SCRIPT = `(function(){try{
var read=function(){var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);return m?decodeURIComponent(m[1]):"light"};
var q=window.matchMedia("(prefers-color-scheme: dark)");
var apply=function(){var t=read();document.documentElement.dataset.theme=t==="auto"?(q.matches?"dark":"light"):t};
apply();
// слушатель ставим всегда, но перекрашиваем только пока выбран режим «как в системе»:
// иначе после ручного выбора темы смена схемы в системе ломала бы выбор пользователя
var on=function(){if(read()==="auto")apply()};
q.addEventListener?q.addEventListener("change",on):q.addListener(on);
}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const theme = themeFromCookie(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <html
      lang="ru"
      data-theme={theme}
      // скрипт меняет data-theme до гидратации, поэтому расхождение ожидаемо
      suppressHydrationWarning
      className={`${literata.variable} ${golos.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        <Toaster position="bottom-center" richColors closeButton offset={96} mobileOffset={96} />
      </body>
    </html>
  );
}
