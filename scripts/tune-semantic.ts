// Diagnostic: sweep SEMANTIC_SIM_THRESHOLD / SEMANTIC_MIN_CLUSTER against the
// real unmatched signals in the DB to pick sane defaults.
import { prisma } from "../src/lib/db";
import { bestBlueprint } from "../src/lib/blueprints";
import { clusterSignals } from "../src/lib/semantic";

async function main() {
  const signals = await prisma.rawSignal.findMany();
  const unmatched = signals.filter((s) => {
    const kw = Array.isArray(s.keywords) ? (s.keywords as string[]) : [];
    return !bestBlueprint(s.text, kw);
  });
  console.log(`señales sin blueprint: ${unmatched.length}/${signals.length}`);

  const input = unmatched.map((s) => ({
    id: s.id,
    text: s.text,
    keywords: Array.isArray(s.keywords) ? (s.keywords as string[]) : [],
    category: s.category,
    engagementScore: s.engagementScore,
  }));

  for (const threshold of [0.06, 0.08, 0.1, 0.12, 0.15, 0.18]) {
    for (const minSize of [2, 3]) {
      process.env.SEMANTIC_SIM_THRESHOLD = String(threshold);
      process.env.SEMANTIC_MIN_CLUSTER = String(minSize);
      const clusters = clusterSignals(input);
      const covered = clusters.reduce((a, c) => a + c.signalIds.length, 0);
      const sizes = clusters.map((c) => c.signalIds.length).join(",");
      console.log(`th=${threshold} min=${minSize} -> ${clusters.length} clusters, ${covered} señales [${sizes}]`);
    }
  }

  // Show the contents of the best-looking config for a sanity check.
  process.env.SEMANTIC_SIM_THRESHOLD = "0.1";
  process.env.SEMANTIC_MIN_CLUSTER = "3";
  for (const c of clusterSignals(input)) {
    console.log(`\n== ${c.key} (${c.signalIds.length}) [${c.topTerms.join(", ")}]`);
    for (const t of c.sampleTexts.slice(0, 4)) console.log("   - " + t.slice(0, 110));
  }
}

main().then(() => process.exit(0));
