import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Idea Radar — Oportunidades de startups validadas por demanda real",
  description:
    "Detecta oportunidades de startups validadas con señales reales de Reddit, X, Product Hunt y Google Trends.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Nav />
        <main className="mx-auto max-w-6xl px-4 pb-20 pt-6">{children}</main>
      </body>
    </html>
  );
}
