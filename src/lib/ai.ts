// Optional AI enrichment layer.
// When AI_ENABLED=true and ANTHROPIC_API_KEY is set, this calls Claude to
// enrich an opportunity (sharper problem statement, MVP, business model,
// "why now"). Otherwise it falls back to the deterministic heuristic output.
// The rest of the pipeline never depends on this — the engine works fully
// offline.

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

export function aiEnabled(): boolean {
  return process.env.AI_ENABLED === "true" && !!process.env.ANTHROPIC_API_KEY;
}

export async function enrichOpportunity(
  input: AIEnrichmentInput,
  fallback: Omit<AIEnrichmentOutput, "source">,
): Promise<AIEnrichmentOutput> {
  if (!aiEnabled()) {
    return { ...fallback, source: "heuristic" };
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY as string,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "claude-sonnet-4-6",
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content:
              `You are a startup analyst. Based ONLY on this evidence, return strict JSON ` +
              `with keys problem, whyNow, mvp, businessModel, gap. Be specific, no fluff.\n\n` +
              `Title: ${input.title}\nCategory: ${input.category}\nAudience: ${input.audience}\n` +
              `Evidence:\n${input.evidence}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in AI response");
    const parsed = JSON.parse(match[0]);
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
