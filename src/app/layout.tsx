import type { Metadata, Viewport } from "next";
import { Literata, Golos_Text } from "next/font/google";
import { Toaster } from "sonner";
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
  title: "Родослов — семейное древо, которое собирают вместе",
  description:
    "Сервис для совместного составления родословной: карточки родственников, связи между поколениями, архив документов и экспорт древа в картинку.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${literata.variable} ${golos.variable}`}>
      <body>
        {children}
        <Toaster position="bottom-center" richColors closeButton />
      </body>
    </html>
  );
}
