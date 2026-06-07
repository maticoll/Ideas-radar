"use client";

export interface FilterState {
  category: string;
  source: string;
  minScore: number;
  minPayment: number;
  region: string;
  segment: string;
  execution: string;
}

export const DEFAULT_FILTERS: FilterState = {
  category: "",
  source: "",
  minScore: 0,
  minPayment: 0,
  region: "",
  segment: "",
  execution: "",
};

interface Props {
  state: FilterState;
  onChange: (s: FilterState) => void;
  categories: string[];
  regions: string[];
}

export function Filters({ state, onChange, categories, regions }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...state, ...patch });

  return (
    <div className="card p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <label className="text-xs text-muted">
          Categoría
          <select className="select mt-1" value={state.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-muted">
          Segmento
          <select className="select mt-1" value={state.segment} onChange={(e) => set({ segment: e.target.value })}>
            <option value="">B2B / B2C</option>
            <option value="B2B">B2B</option>
            <option value="B2C">B2C</option>
            <option value="B2B2C">B2B2C</option>
          </select>
        </label>

        <label className="text-xs text-muted">
          Región
          <select className="select mt-1" value={state.region} onChange={(e) => set({ region: e.target.value })}>
            <option value="">Todas</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-muted">
          Ejecución
          <select className="select mt-1" value={state.execution} onChange={(e) => set({ execution: e.target.value })}>
            <option value="">Cualquiera</option>
            <option value="easy">Fácil (MVP ≥ 70)</option>
            <option value="medium">Media (50–69)</option>
            <option value="hard">Difícil (&lt; 50)</option>
          </select>
        </label>

        <label className="text-xs text-muted">
          Score mín: <span className="text-text">{state.minScore}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={state.minScore}
            onChange={(e) => set({ minScore: Number(e.target.value) })}
            className="mt-2 w-full accent-indigo-500"
          />
        </label>

        <label className="text-xs text-muted">
          Intención pago mín: <span className="text-text">{state.minPayment}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={state.minPayment}
            onChange={(e) => set({ minPayment: Number(e.target.value) })}
            className="mt-2 w-full accent-indigo-500"
          />
        </label>

        <div className="flex items-end">
          <button className="btn w-full" onClick={() => onChange({ ...DEFAULT_FILTERS })}>
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );
}
