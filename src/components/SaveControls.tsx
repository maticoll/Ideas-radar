"use client";

import { useState } from "react";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/idea";

const STATUSES = ["research", "validate", "discard", "build"];

export function SaveControls({
  ideaId,
  initialStatus,
  initialNotes,
  initialSaved,
}: {
  ideaId: string;
  initialStatus: string | null;
  initialNotes: string;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [status, setStatus] = useState<string>(initialStatus || "research");
  const [notes, setNotes] = useState(initialNotes);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  async function toggleSave() {
    const res = await fetch(`/api/ideas/${ideaId}/save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toggle: saved }),
    });
    const data = await res.json();
    setSaved(data.saved);
  }

  async function changeStatus(s: string) {
    setStatus(s);
    setSaved(true);
    await fetch(`/api/ideas/${ideaId}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: s }),
    });
  }

  async function saveNotes() {
    setSavingNotes(true);
    await fetch(`/api/ideas/${ideaId}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSaved(true);
    setSavingNotes(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Tu workflow</h3>
        <button className={`btn ${saved ? "" : "btn-primary"}`} onClick={toggleSave}>
          {saved ? "★ Guardada" : "☆ Guardar"}
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs text-muted">Estado</p>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => changeStatus(s)}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium transition"
              style={{
                borderColor: status === s ? STATUS_COLORS[s] : "#26304a",
                color: status === s ? STATUS_COLORS[s] : "#8b97b3",
                background: status === s ? "rgba(255,255,255,0.03)" : "transparent",
              }}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-muted">Notas internas</p>
        <textarea
          className="input min-h-[110px] resize-y"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Hipótesis, próximos pasos, contactos para validar…"
        />
        <div className="mt-2 flex items-center gap-3">
          <button className="btn btn-primary" onClick={saveNotes} disabled={savingNotes}>
            {savingNotes ? "Guardando…" : "Guardar notas"}
          </button>
          {savedFlash && <span className="text-xs text-good">Guardado ✓</span>}
        </div>
      </div>
    </div>
  );
}
