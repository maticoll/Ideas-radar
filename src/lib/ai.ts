// Optional AI enrichment layer.
// When ANTHROPIC_API_KEY is set (and AI_ENABLED isn't "false"), this calls
// Claude to enrich an opportunity (sharper problem statement, MVP, business
// model, "why now") and to describe semantic clusters discovered by T6.
// Otherwise it falls back to the deterministic heuristic output. The rest of
// the pipeline never depends on this — the engine works fully offline.

export interface AIEnrichmentInput {
  title: string;
  problem: string;
  audience: string;
  category: string;
  evidence: string;
}

export interface AIEnrichmentOutput {
  problem: string;
  whyNow: string;
  mvp: string;
  businessModel: string;
  gap: string;
  source: "ai" | "heuristic";
}

// T5: AI is on by default whenever a key is present; AI_ENABLED=false opts out.
export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && process.env.AI_ENABLED !== "false";
}

async function askClaude(prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
  const data = await res.json();
  return data?.content?.[0]?.text ?? "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJson(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in AI response");
  return JSON.parse(match[0]);
}

export async function enrichOpportunity(
  input: AIEnrichmentInput,
  fallback: Omit<AIEnrichmentOutput, "source">,
): Promise<AIEnrichmentOutput> {
  if (!aiEnabled()) {
    return { ...fallback, source: "heuristic" };
  }

  try {
    const text = await askClaude(
      `You are a startup analyst. Based ONLY on this evidence, return strict JSON ` +
        `with keys problem, whyNow, mvp, businessModel, gap. Write the values in Spanish. ` +
        `Be specific, no fluff.\n\n` +
        `Title: ${input.title}\nCategory: ${input.category}\nAudience: ${input.audience}\n` +
        `Evidence:\n${input.evidence}`,
      800,
    );
    const parsed = extractJson(text);
    return {
      problem: parsed.problem || fallback.problem,
      whyNow: parsed.whyNow || fallback.whyNow,
      mvp: parsed.mvp || fallback.mvp,
      businessModel: parsed.businessModel || fallback.businessModel,
      gap: parsed.gap || fallback.gap,
      source: "ai",
    };
  } catch (err) {
    console.warn("[ai] enrichment failed, using heuristic fallback:", (err as Error).message);
    return { ...fallback, source: "heuristic" };
  }
}

// ---- T6: describe a semantic cluster discovered from raw signals -----------

export interface ClusterDescriptionInput {
  topTerms: string[];
  category: string; // majority category among the cluster's signals
  signalCount: number;
  sampleTexts: string[];
}

export interface ClusterDescription {
  title: string;
  problem: string;
  audience: string;
  whyNow: string;
  gap: string;
  mvp: string;
  businessModel: string;
  category: string;
  segment: "B2B" | "B2C" | "B2B2C";
  source: "ai" | "heuristic";
}

function heuristicClusterDescription(input: ClusterDescriptionInput): ClusterDescription {
  const terms = input.topTerms.slice(0, 3).join(", ");
  return {
    title: `Demanda emergente: ${terms}`,
    problem:
      `${input.signalCount} personas piden una herramienta relacionada con ${terms} ` +
      `y no encuentran una solución que les sirva.`,
    audience: "Usuarios que expresaron esta necesidad en foros técnicos y comunidades.",
    whyNow: "La demanda aparece de forma repetida en señales recientes de varias fuentes.",
    gap: "Las soluciones existentes no cubren este caso según las señales agrupadas.",
    mvp: `Herramienta enfocada en ${terms}, validable con una landing + lista de espera.`,
    businessModel: "SaaS por suscripción (a validar con los primeros usuarios).",
    category: input.category,
    segment: "B2B",
    source: "heuristic",
  };
}

const VALID_SEGMENTS = new Set(["B2B", "B2C", "B2B2C"]);

// Writes the qualitative fields of a dynamically-discovered opportunity from
// the cluster's real evidence, and acts as a COHERENCE GATE: lexical
// clustering can glue unrelated posts via one shared generic word, so the AI
// returns null when the posts don't share one real unmet need and the
// pipeline drops the candidate. Scoring stays deterministic — this only
// writes text/classification, never the numbers that drive the ranking.
// Without an AI key the heuristic fallback always publishes (no gate).
export async function describeCluster(input: ClusterDescriptionInput): Promise<ClusterDescription | null> {
  const fallback = heuristicClusterDescription(input);
  if (!aiEnabled()) return fallback;

  try {
    const text = await askClaude(
      `You are a startup analyst. The following are real, recent posts from internet ` +
        `forums, grouped automatically because they MAY describe the same unmet need. ` +
        `First decide: do these posts share ONE common unmet need that could become a ` +
        `product? If NOT, return exactly {"coherent": false}. If yes, synthesize ONE ` +
        `startup opportunity. Return strict JSON with keys: title (max 70 chars), problem, ` +
        `audience, whyNow, gap, mvp, businessModel, category, segment. Write all values in ` +
        `Spanish except category and segment. category must be one of: Productivity, Fintech, ` +
        `"Developer Tools", Marketing, "Health & Wellness", "E-commerce", Education, ` +
        `"AI & Automation", "Creator Economy", "HR & Recruiting". segment must be B2B, B2C or ` +
        `B2B2C. Base everything ONLY on the evidence; be specific, no fluff.\n\n` +
        `Recurring terms: ${input.topTerms.join(", ")}\n` +
        `Signals in group: ${input.signalCount}\n\n` +
        input.sampleTexts.map((t, i) => `${i + 1}. ${t}`).join("\n"),
      1000,
    );
    const parsed = extractJson(text);
    if (parsed.coherent === false) return null; // AI judged the cluster incoherent
    return {
      title: String(parsed.title || fallback.title).slice(0, 90),
      problem: String(parsed.problem || fallback.problem),
      audience: String(parsed.audience || fallback.audience),
      whyNow: String(parsed.whyNow || fallback.whyNow),
      gap: String(parsed.gap || fallback.gap),
      mvp: String(parsed.mvp || fallback.mvp),
      businessModel: String(parsed.businessModel || fallback.businessModel),
      category: String(parsed.category || fallback.category),
      segment: VALID_SEGMENTS.has(String(parsed.segment)) ? (String(parsed.segment) as ClusterDescription["segment"]) : "B2B",
      source: "ai",
    };
  } catch (err) {
    console.warn("[ai] cluster description failed, using heuristic fallback:", (err as Error).message);
    return fallback;
  }
}
