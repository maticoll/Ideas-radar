"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function UnlockForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const from = params.get("from") || "/";
        router.replace(from.startsWith("/") ? from : "/");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo desbloquear.");
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-[70vh] place-items-center">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand2 text-sm font-black text-white">
            IR
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              Idea<span className="text-brand2">Radar</span>
            </h1>
            <p className="text-xs text-muted">Acceso privado</p>
          </div>
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-xs text-muted">
            Clave de acceso
          </label>
          <input
            id="password"
            type="password"
            autoFocus
            autoComplete="current-password"
            className="input w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-sm text-bad">{error}</p>}

        <button type="submit" className="btn btn-primary w-full" disabled={loading || !password}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

export default function UnlockPage() {
  return (
    <Suspense fallback={<div className="card mx-auto mt-20 h-64 max-w-sm animate-pulse" />}>
      <UnlockForm />
    </Suspense>
  );
}
