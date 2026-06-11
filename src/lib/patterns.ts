// Intent & pain detection. Pure functions, no external calls — this is the
// deterministic heuristic layer that runs even when no AI key is configured.

// Phrases that strongly signal willingness to pay.
export const PAYMENT_INTENT_PATTERNS: { pattern: RegExp; label: string; weight: number }[] = [
  { pattern: /\bi(?:'| wou)?ld pay\b/i, label: "I would pay for…", weight: 40 },
  { pattern: /\bi'?d pay\b/i, label: "I'd pay for…", weight: 40 },
  { pattern: /\bshut up and take my money\b/i, label: "take my money", weight: 45 },
  { pattern: /\bwould happily pay\b/i, label: "would happily pay", weight: 42 },
  { pattern: /\bpay (?:good )?money for\b/i, label: "pay money for", weight: 38 },
  { pattern: /\bworth paying for\b/i, label: "worth paying for", weight: 30 },
  { pattern: /\b(?:subscribe|subscription) for\b/i, label: "would subscribe", weight: 28 },
];

// Phrases that signal an unmet need / product gap.
export const NEED_PATTERNS: { pattern: RegExp; label: string; weight: number }[] = [
  { pattern: /\bi wish there was\b/i, label: "I wish there was…", weight: 30 },
  { pattern: /\bwhy (?:doesn'?t|does no one|isn'?t there)\b/i, label: "Why doesn't someone build…", weight: 32 },
  { pattern: /\bsomeone should build\b/i, label: "Someone should build…", weight: 34 },
  { pattern: /\bis there a tool that\b/i, label: "Is there a tool that…", weight: 26 },
  { pattern: /\blooking for an app that\b/i, label: "Looking for an app that…", weight: 28 },
  { pattern: /\bi need a tool (?:that|for)\b/i, label: "I need a tool that…", weight: 30 },
  { pattern: /\bwhy is there no app for\b/i, label: "Why is there no app for…", weight: 33 },
  { pattern: /\bi wish i had a tool for\b/i, label: "I wish I had a tool for…", weight: 30 },
  { pattern: /\bhow do i automate\b/i, label: "How do I automate…", weight: 24 },
  // Phrasings common on Stack Exchange / Hacker News asks. "alternative to"
  // alone is too broad (matches news headlines), so it always needs tool-ish
  // context around it.
  { pattern: /\blooking for (?:a |an |some )?(?:free |open.?source |self.?hosted |simple )?(?:software|web ?app|app|application|tool|service|program|solution)\b/i, label: "Looking for a tool…", weight: 26 },
  { pattern: /\bis there (?:a |an |any )?(?:free |open.?source |self.?hosted |simple )?(?:software|web ?app|app|application|tool|service|program|solution)\b/i, label: "Is there a tool…", weight: 26 },
  { pattern: /\b(?:can (?:anyone|someone|you) )?recommend (?:me )?(?:a |an |any |some )?(?:software|web ?app|app|application|tool|service|program)\b/i, label: "Recommend a tool…", weight: 24 },
  { pattern: /\brecommendations? (?:for|of|on) (?:a |an |any |some )?(?:software|web ?app|app|application|tool|service|program)\b/i, label: "Recommend a tool…", weight: 24 },
  { pattern: /\b(?:looking for|need|want|searching for) (?:a |an )?(?:free |open.?source |self.?hosted |better |cheaper |good )?alternatives? to\b/i, label: "Alternative to…", weight: 24 },
  { pattern: /\b(?:free|open.?source|self.?hosted|better|cheaper|good) alternatives? to\b/i, label: "Alternative to…", weight: 24 },
  { pattern: /\bany (?:good |free )?(?:tool|app|software|service) (?:for|that|to)\b/i, label: "Any tool for…", weight: 24 },
];

// Phrases that signal pain / frustration.
export const PAIN_PATTERNS: { pattern: RegExp; label: string; weight: number }[] = [
  { pattern: /\bi hate using\b/i, label: "I hate using…", weight: 30 },
  { pattern: /\bthis is so annoying\b/i, label: "This is so annoying…", weight: 26 },
  { pattern: /\bso frustrating\b/i, label: "so frustrating", weight: 26 },
  { pattern: /\bwaste(?:s|d)? (?:hours|time)\b/i, label: "wastes hours", weight: 24 },
  { pattern: /\bdriving me (?:crazy|nuts)\b/i, label: "driving me crazy", weight: 28 },
  { pattern: /\bcan'?t stand\b/i, label: "can't stand", weight: 22 },
  { pattern: /\bnightmare\b/i, label: "nightmare", weight: 20 },
  { pattern: /\bclunky\b/i, label: "clunky", weight: 16 },
];

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "to", "of", "in", "on", "is", "it",
  "i", "my", "me", "we", "you", "they", "this", "that", "with", "so", "do", "be",
  "have", "has", "had", "would", "could", "should", "there", "no", "not", "as",
  "at", "by", "from", "are", "was", "were", "if", "than", "then", "too", "can",
]);

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function extractKeywords(text: string, max = 6): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}

export interface IntentResult {
  paymentIntentScore: number;
  painScore: number;
  matchedPattern: string | null;
  isSignal: boolean; // separates noise from valuable signals
}

export function analyzeIntent(text: string): IntentResult {
  let payment = 0;
  let pain = 0;
  let matched: string | null = null;

  for (const p of PAYMENT_INTENT_PATTERNS) {
    if (p.pattern.test(text)) {
      payment += p.weight;
      matched = matched ?? p.label;
    }
  }
  for (const p of NEED_PATTERNS) {
    if (p.pattern.test(text)) {
      pain += p.weight * 0.6;
      payment += p.weight * 0.3;
      matched = matched ?? p.label;
    }
  }
  for (const p of PAIN_PATTERNS) {
    if (p.pattern.test(text)) {
      pain += p.weight;
      matched = matched ?? p.label;
    }
  }

  const paymentIntentScore = clamp(payment);
  const painScore = clamp(pain);
  // A row is a "signal" (not noise) if it matched an intent/need/pain pattern.
  const isSignal = matched !== null;

  return { paymentIntentScore, painScore, matchedPattern: matched, isSignal };
}

// Lightweight category classifier based on keyword buckets.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Fintech: ["invoice", "invoices", "tax", "taxes", "accounting", "payment", "payments", "budget", "expense", "expenses", "payroll", "freelancer", "billing"],
  "Developer Tools": ["api", "code", "deploy", "debug", "logs", "database", "devops", "cli", "sdk", "git", "testing", "monitoring"],
  Marketing: ["seo", "ads", "campaign", "newsletter", "email", "leads", "funnel", "analytics", "content", "social"],
  "Health & Wellness": ["sleep", "fitness", "diet", "mental", "therapy", "habit", "meditation", "workout", "nutrition"],
  "E-commerce": ["shopify", "store", "product", "inventory", "shipping", "returns", "checkout", "dropshipping"],
  Education: ["course", "learn", "students", "teacher", "study", "tutor", "lessons", "homework", "exam"],
  "AI & Automation": ["automate", "automation", "workflow", "agent", "scraping", "zapier", "integration", "bots"],
  "Creator Economy": ["youtube", "podcast", "creator", "thumbnail", "editing", "streaming", "audience", "subscribers"],
  "HR & Recruiting": ["hiring", "recruit", "candidate", "resume", "onboarding", "interview", "applicants", "ats"],
  Productivity: ["notes", "calendar", "tasks", "todo", "meeting", "scheduling", "organize", "files", "documents"],
};

export function classifyCategory(text: string, keywords: string[]): string {
  const haystack = (text + " " + keywords.join(" ")).toLowerCase();
  let best = "Productivity";
  let bestHits = 0;
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    const hits = words.reduce((acc, w) => acc + (haystack.includes(w) ? 1 : 0), 0);
    if (hits > bestHits) {
      bestHits = hits;
      best = cat;
    }
  }
  return best;
}
