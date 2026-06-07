// Opportunity blueprints. These are the "topics" the clustering engine groups
// raw signals into. Each blueprint carries the qualitative framing (problem,
// audience, MVP, business model, etc.) while the *scores* are computed at
// runtime from the actual aggregated signals + trends + abandoned products.
// The optional AI layer can rewrite the qualitative fields from the evidence.

export interface Blueprint {
  key: string;
  match: string[]; // lowercase keywords/phrases used to assign signals
  title: string;
  problem: string;
  audience: string;
  whyNow: string;
  gap: string;
  mvp: string;
  businessModel: string;
  competitors: string[];
  category: string;
  segment: "B2B" | "B2C" | "B2B2C";
  region: string;
  trendKeyword: string;
  phProductName?: string; // matched abandoned Product Hunt product
  // Blueprint-level heuristics (0-100)
  competitionScore: number; // higher = more crowded market
  audienceClarity: number;
  mvpEase: number;
  marketPotential: number;
}

export const BLUEPRINTS: Blueprint[] = [
  {
    key: "invoice-chaser",
    match: ["invoice", "invoices", "billing", "late", "unpaid", "reconcile", "stripe", "payout"],
    title: "Auto-chaser de facturas para freelancers",
    problem:
      "Freelancers y pequeños negocios pierden horas persiguiendo manualmente facturas vencidas y conciliando pagos de Stripe con su contabilidad.",
    audience: "Freelancers, agencias pequeñas y solopreneurs que facturan por proyecto.",
    whyNow:
      "El auge del trabajo freelance + APIs de pago abiertas (Stripe) hacen viable automatizar el cobro; un producto querido (InvoiceChaser) quedó abandonado dejando demanda huérfana.",
    gap: "Las herramientas existentes son contables pesadas o recordatorios genéricos; nadie cierra el loop cobro→conciliación de forma simple.",
    mvp: "Integración Stripe + email/WhatsApp que detecta facturas vencidas y envía recordatorios escalonados con tono configurable, más un panel de cuentas por cobrar.",
    businessModel: "SaaS por suscripción ($15–40/mes) con plan freemium hasta N facturas.",
    competitors: ["InvoiceChaser (abandonado)", "Bonsai", "Stripe Invoicing", "QuickBooks"],
    category: "Fintech",
    segment: "B2B",
    region: "United States",
    trendKeyword: "automate invoice reminders",
    phProductName: "InvoiceChaser",
    competitionScore: 55,
    audienceClarity: 88,
    mvpEase: 78,
    marketPotential: 82,
  },
  {
    key: "meeting-to-tasks",
    match: ["meeting", "meetings", "transcript", "recording", "action", "items", "notes", "calendar"],
    title: "De reuniones a tareas asignadas automáticamente",
    problem:
      "Equipos graban reuniones pero convierten a mano las decisiones en tareas asignadas, lo que se pierde o consume tiempo.",
    audience: "Product managers, líderes de equipo y consultoras remotas.",
    whyNow:
      "La transcripción por IA es barata y precisa en 2026; un producto popular (MeetingToTasks) fue abandonado y los usuarios piden alternativas activamente.",
    gap: "Los resúmenes de IA existen, pero pocos asignan owners y sincronizan con el gestor de tareas/calendario de forma bidireccional.",
    mvp: "Sube/conecta la grabación → IA extrae action items con responsable y fecha → push a Asana/Linear/Notion y al calendario.",
    businessModel: "SaaS por asiento ($10–18/usuario/mes), freemium por minutos.",
    competitors: ["MeetingToTasks (abandonado)", "Otter.ai", "Fireflies", "Fathom"],
    category: "Productivity",
    segment: "B2B",
    region: "Worldwide",
    trendKeyword: "meeting notes to tasks",
    phProductName: "MeetingToTasks",
    competitionScore: 62,
    audienceClarity: 84,
    mvpEase: 70,
    marketPotential: 86,
  },
  {
    key: "support-to-faq",
    match: ["support", "faq", "tickets", "inbox", "help", "center", "customer"],
    title: "Inbox de soporte → FAQ viva con IA",
    problem:
      "Los equipos responden las mismas preguntas una y otra vez; convertir el soporte en una base de conocimiento se hace manual y queda desactualizada.",
    audience: "Equipos de soporte y éxito de cliente en SaaS y e-commerce.",
    whyNow:
      "La deflexión de tickets con IA es prioridad de costos; FAQforge tenía buena recepción pero fue abandonado tras rumores de adquisición.",
    gap: "Las bases de conocimiento son estáticas; falta una que se actualice sola desde los tickets reales y mida deflexión.",
    mvp: "Conector a Zendesk/Intercom/Gmail que agrupa preguntas frecuentes, genera artículos editables y publica un widget de FAQ.",
    businessModel: "SaaS por suscripción con pricing por volumen de tickets.",
    competitors: ["FAQforge (abandonado)", "Intercom Fin", "Zendesk", "Notion"],
    category: "AI & Automation",
    segment: "B2B",
    region: "United States",
    trendKeyword: "support email to faq",
    phProductName: "FAQforge",
    competitionScore: 58,
    audienceClarity: 80,
    mvpEase: 68,
    marketPotential: 79,
  },
  {
    key: "stockout-predictor",
    match: ["stockout", "stock", "inventory", "shopify", "restock", "velocity", "returns"],
    title: "Predicción de quiebres de stock para Shopify",
    problem:
      "Tiendas Shopify pierden ventas por quiebres de stock y capital por sobre-inventario, sin pronóstico simple basado en su velocidad de ventas.",
    audience: "Dueños de tiendas Shopify de tamaño medio y operadores DTC.",
    whyNow:
      "Márgenes ajustados en e-commerce hacen crítico el forecasting; StockSeer tuvo tracción pero los fundadores pivotearon.",
    gap: "Las apps de inventario son complejas o caras; falta una que prediga y avise sin configuración.",
    mvp: "App de Shopify que ingiere historial de ventas, predice fechas de quiebre por SKU y envía alertas de reorden.",
    businessModel: "SaaS en el Shopify App Store, suscripción por nivel de SKUs.",
    competitors: ["StockSeer (abandonado)", "Inventory Planner", "Cogsy"],
    category: "E-commerce",
    segment: "B2B",
    region: "United Kingdom",
    trendKeyword: "shopify stockout prediction",
    phProductName: "StockSeer",
    competitionScore: 50,
    audienceClarity: 82,
    mvpEase: 64,
    marketPotential: 75,
  },
  {
    key: "localized-social",
    match: ["social", "posts", "localized", "schedule", "scheduling", "content", "marketing", "newsletter"],
    title: "Generador y scheduler de social posts localizados",
    problem:
      "Marketers manejan cinco herramientas para crear, traducir y agendar contenido social por mercado; el proceso es lento y fragmentado.",
    audience: "Marketers de PYMES y agencias que gestionan varias marcas/idiomas.",
    whyNow:
      "La generación multilingüe con IA y las APIs de publicación maduras permiten un flujo de un solo brief a un mes de contenido.",
    gap: "Los schedulers no localizan bien y los generadores no agendan; nadie une brief→localización→publicación.",
    mvp: "Un brief genera un calendario de posts por idioma/mercado, editable, y los agenda en las redes conectadas.",
    businessModel: "SaaS por marca/asiento, freemium con marca de agua.",
    competitors: ["Buffer", "Hootsuite", "Later", "Typefully"],
    category: "Marketing",
    segment: "B2B",
    region: "Worldwide",
    trendKeyword: "localized social media scheduler",
    competitionScore: 70,
    audienceClarity: 76,
    mvpEase: 66,
    marketPotential: 80,
  },
  {
    key: "status-page",
    match: ["status", "page", "self-hosted", "selfhosted", "uptime", "monitoring", "homelab", "services"],
    title: "Status page self-hosted sin configuración",
    problem:
      "Desarrolladores y homelabbers quieren una status page self-hosted que detecte sus servicios sola; las opciones existentes son clunky o requieren mucha config.",
    audience: "Desarrolladores indie, equipos de DevOps pequeños y comunidad self-hosted.",
    whyNow:
      "El movimiento self-hosted crece y StatusZen quedó estancado, dejando una base de usuarios sin mantenimiento.",
    gap: "Falta una solución de cero-config que auto-descubra servicios y sea agradable de usar.",
    mvp: "Binario/Docker que escanea la red local, detecta servicios y publica una status page con alertas.",
    businessModel: "Open-core: gratis self-hosted, plan cloud/equipo de pago.",
    competitors: ["StatusZen (abandonado)", "Uptime Kuma", "Statuspage", "Cachet"],
    category: "Developer Tools",
    segment: "B2C",
    region: "Germany",
    trendKeyword: "self hosted status page",
    phProductName: "StatusZen",
    competitionScore: 60,
    audienceClarity: 72,
    mvpEase: 74,
    marketPotential: 62,
  },
  {
    key: "proposal-from-call",
    match: ["proposal", "proposals", "transcript", "client", "sow", "draft", "call"],
    title: "Propuestas de cliente desde la transcripción de una llamada",
    problem:
      "Freelancers y agencias pierden horas redactando propuestas/SOW después de cada llamada de descubrimiento.",
    audience: "Freelancers, agencias y consultores que venden servicios.",
    whyNow:
      "La transcripción + IA generativa permiten convertir una llamada en una propuesta estructurada en minutos.",
    gap: "Los generadores de propuestas parten de plantillas, no de la conversación real con el cliente.",
    mvp: "Sube la grabación/transcript → IA redacta propuesta con alcance, precio y entregables, exportable a PDF.",
    businessModel: "SaaS por suscripción, freemium por número de propuestas.",
    competitors: ["Better Proposals", "PandaDoc", "Bonsai"],
    category: "Productivity",
    segment: "B2B",
    region: "United States",
    trendKeyword: "proposal from call transcript",
    competitionScore: 52,
    audienceClarity: 78,
    mvpEase: 72,
    marketPotential: 70,
  },
];

export function bestBlueprint(text: string, keywords: string[]): Blueprint | null {
  const haystack = (text + " " + keywords.join(" ")).toLowerCase();
  let best: Blueprint | null = null;
  let bestHits = 0;
  for (const bp of BLUEPRINTS) {
    const hits = bp.match.reduce((acc, m) => acc + (haystack.includes(m) ? 1 : 0), 0);
    if (hits > bestHits) {
      bestHits = hits;
      best = bp;
    }
  }
  return bestHits > 0 ? best : null;
}
