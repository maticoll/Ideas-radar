"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/history", label: "Historial" },
  { href: "/favorites", label: "Favoritos" },
];

export function Nav() {
  const path = usePathname();
  const router = useRouter();

  // The unlock screen has no navigation (every link would just bounce back).
  if (path === "/unlock") return null;

  async function lock() {
    await fetch("/api/unlock", { method: "DELETE" }).catch(() => {});
    router.replace("/unlock");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand2 text-sm font-black text-white">
            IR
          </span>
          <span className="text-lg font-bold tracking-tight">
            Idea<span className="text-brand2">Radar</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-panel2 text-white" : "text-muted hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <button
            onClick={lock}
            className="ml-1 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:text-white"
            title="Bloquear el acceso"
          >
            Bloquear
          </button>
        </nav>
      </div>
    </header>
  );
}
