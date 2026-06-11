// Semantic discovery (T6): clusters signals that match NO blueprint, so
// opportunities can emerge from the data instead of a fixed catalog.
//
// Deterministic and dependency-free: TF-IDF vectors over signal text + greedy
// centroid clustering by cosine similarity, followed by a centroid merge pass.
// There is nothing to cache per signal (vectors are batch-relative and cheap
// to compute in-process). A real embeddings provider could replace vectorize()
// later without touching the pipeline contract.
//
// Tuning knobs (env):
//   SEMANTIC_SIM_THRESHOLD — min cosine similarity to join a cluster (default
//                            0.10, swept against real HN/SE data — see
//                            scripts/tune-semantic.ts)
//   SEMANTIC_MIN_CLUSTER   — min signals per kept cluster (default 2: the AI
//                            coherence gate filters quality, so we prefer
//                            more candidates over fewer)
//
// Lexical clustering on short texts is recall-oriented: clusters can be glued
// by a shared generic word. The AI coherence gate in describeCluster()
// (pipeline persist step) discards candidate clusters that don't share one
// real unmet need.

export interface ClusterableSignal {
  id: string;
  text: string;
  keywords: string[];
  category: string;
  engagementScore: number;
}

export interface SemanticCluster {
  key: string; // "dyn-<top terms>" — stable while the cluster's vocabulary is stable
  signalIds: string[];
  topTerms: string[];
  category: string; // majority category among member signals
  sampleTexts: string[]; // most-engaged texts, for the AI/heuristic description
}

// Generic demand words appear in almost every signal ("I wish there was a
// TOOL…") — left in, they'd glue unrelated clusters together.
const GENERIC_WORDS = new Set([
  "tool", "tools", "app", "apps", "application", "applications", "software",
  "service", "services", "program", "programs", "solution", "solutions",
  "platform", "website", "site", "web",
  "looking", "searching", "need", "needs", "want", "wants", "wish", "wished",
  "pay", "paying", "paid", "build", "built", "builds", "someone", "anyone",
  "alternative", "alternatives", "recommend", "recommendation", "recommendations",
  "free", "open", "source", "simple", "good", "better", "best", "great",
  "using", "used", "use", "uses", "like", "just", "really", "make", "makes",
  "way", "ways", "does", "doesn", "don", "cant", "can", "able", "every",
  "exist", "exists", "there", "thing", "things", "something", "anything",
  "still", "would", "could", "should", "know", "find", "help", "work", "works",
]);

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "to", "of", "in", "on", "is",
  "it", "i", "my", "me", "we", "you", "they", "this", "that", "with", "so",
  "do", "be", "have", "has", "had", "there", "no", "not", "as", "at", "by",
  "from", "are", "was", "were", "if", "than", "then", "too", "when", "what",
  "which", "who", "how", "why", "where", "your", "our", "their", "his", "her",
  "its", "them", "him", "she", "he", "been", "being", "into", "out", "about",
  "also", "more", "most", "some", "any", "all", "very", "much", "many", "other",
]);

function tokenize(text: string, keywords: string[]): string[] {
  return (text.toLowerCase() + " " + keywords.join(" ").toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w) && !GENERIC_WORDS.has(w));
}

type Vector = Map<string, number>;

function vectorize(signals: ClusterableSignal[]): Vector[] {
  const docs = signals.map((s) => tokenize(s.text, s.keywords));
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const term of new Set(doc)) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const n = docs.length;
  return docs.map((doc) => {
    const tf = new Map<string, number>();
    for (const term of doc) tf.set(term, (tf.get(term) ?? 0) + 1);
    const vec: Vector = new Map();
    for (const [term, count] of tf) {
      const idf = Math.log(1 + n / (df.get(term) ?? 1));
      vec.set(term, (count / doc.length) * idf);
    }
    return vec;
  });
}

function cosine(a: Vector, b: Vector): number {
  if (!a.size || !b.size) return 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, w] of small) {
    const w2 = big.get(term);
    if (w2) dot += w * w2;
  }
  let na = 0;
  for (const w of a.values()) na += w * w;
  let nb = 0;
  for (const w of b.values()) nb += w * w;
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function addToCentroid(centroid: Vector, vec: Vector, newSize: number): void {
  // incremental mean: c' = c + (v - c) / n
  const terms = new Set([...centroid.keys(), ...vec.keys()]);
  for (const term of terms) {
    const c = centroid.get(term) ?? 0;
    const v = vec.get(term) ?? 0;
    centroid.set(term, c + (v - c) / newSize);
  }
}

function envNumber(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function topTerms(centroid: Vector, count: number): string[] {
  return [...centroid.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([term]) => term);
}

function majorityCategory(members: ClusterableSignal[]): string {
  const freq = new Map<string, number>();
  for (const m of members) freq.set(m.category, (freq.get(m.category) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

interface WorkingCluster {
  centroid: Vector;
  members: number[]; // indices into the signals array
}

export function clusterSignals(signals: ClusterableSignal[]): SemanticCluster[] {
  if (signals.length < 2) return [];
  const threshold = envNumber("SEMANTIC_SIM_THRESHOLD", 0.1);
  const minSize = envNumber("SEMANTIC_MIN_CLUSTER", 2);

  // Deterministic order regardless of DB return order.
  const ordered = signals.map((s, i) => ({ s, i })).sort((a, b) => (a.s.id < b.s.id ? -1 : 1));
  const vectors = vectorize(signals);

  // Greedy pass: join the most similar centroid above the threshold.
  const clusters: WorkingCluster[] = [];
  for (const { i } of ordered) {
    let best: WorkingCluster | null = null;
    let bestSim = 0;
    for (const c of clusters) {
      const sim = cosine(c.centroid, vectors[i]);
      if (sim > bestSim) {
        bestSim = sim;
        best = c;
      }
    }
    if (best && bestSim >= threshold) {
      best.members.push(i);
      addToCentroid(best.centroid, vectors[i], best.members.length);
    } else {
      clusters.push({ centroid: new Map(vectors[i]), members: [i] });
    }
  }

  // Merge pass: greedy order can split a topic into two clusters.
  for (let a = 0; a < clusters.length; a++) {
    for (let b = clusters.length - 1; b > a; b--) {
      if (cosine(clusters[a].centroid, clusters[b].centroid) >= threshold) {
        for (const i of clusters[b].members) {
          clusters[a].members.push(i);
          addToCentroid(clusters[a].centroid, vectors[i], clusters[a].members.length);
        }
        clusters.splice(b, 1);
      }
    }
  }

  return clusters
    .filter((c) => c.members.length >= minSize)
    .map((c) => {
      const members = c.members.map((i) => signals[i]);
      const terms = topTerms(c.centroid, 5);
      const keyTerms = terms.slice(0, 3).sort(); // alphabetical: stable across runs
      return {
        key: `dyn-${keyTerms.join("-")}`.slice(0, 64),
        signalIds: members.map((m) => m.id),
        topTerms: terms,
        category: majorityCategory(members),
        sampleTexts: [...members]
          .sort((x, y) => y.engagementScore - x.engagementScore)
          .slice(0, 8)
          .map((m) => m.text.slice(0, 300)),
      };
    });
}
