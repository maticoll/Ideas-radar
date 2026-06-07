# Idea Radar 🛰️

Detecta **oportunidades de startups validadas por demanda real** en internet. Cada día,
Idea Radar analiza señales de dolor, intención de compra y productos abandonados en
**Reddit, X/Twitter, Product Hunt y Google Trends**, las agrupa en oportunidades y muestra
las **5 mejores ideas** rankeadas por tamaño de demanda y oportunidad.

> Las integraciones externas vienen con una **capa demo/mock** lista para usar sin
> credenciales. La estructura está desacoplada para conectar las APIs reales cuando quieras,
> respetando siempre los términos de servicio de cada plataforma.

---

## Stack

- **Front-end + Back-end:** Next.js 14 (App Router, TypeScript) — un solo proyecto.
- **Base de datos:** Prisma. Por defecto **SQLite** (cero configuración); cambia a
  **PostgreSQL** con una variable de entorno.
- **Gráficos:** Recharts (tendencias + desglose de score).
- **Motor de análisis:** heurístico y determinista (funciona offline), con un **hook de IA
  opcional** (Claude) para enriquecer ideas.
- **Jobs programados:** rutas `/api/cron/*` + scripts standalone + `vercel.json`.

## Arquitectura

```
src/
  app/                     # Front-end (páginas) + API routes (back-end)
    page.tsx               # Dashboard: top 5 + explorador con filtros
    idea/[id]/page.tsx     # Detalle de idea: evidencia, charts, score desglosado
    history/page.tsx       # Historial: ranking, guardadas, descartadas
    favorites/page.tsx     # Favoritos por estado + notas
    api/                   # Endpoints REST (ver abajo) + cron jobs
  components/              # UI (cards, charts, filtros, controles)
  lib/
    collectors/            # Reddit / Twitter / Product Hunt / Trends (mock + real-ready)
    patterns.ts            # Detección de intención de pago, dolor, keywords, categoría
    blueprints.ts          # Topics para agrupar señales en oportunidades
    scoring.ts             # Score 0–100 (10 factores ponderados)
    pipeline.ts            # collect (6h) + rank (diario): el motor completo
    ai.ts                  # Hook opcional de Claude (fallback heurístico)
prisma/
  schema.prisma           # Modelo de datos (SQLite por defecto, Postgres listo)
  seed.ts                 # Corre el pipeline real para generar datos demo
scripts/                  # Runners de cron para system cron / CI / workers
```

Capas claramente separadas: **front-end** (componentes/páginas), **back-end** (API routes),
**servicios externos** (collectors desacoplados), **motor** (patterns/blueprints/scoring/
pipeline) y **jobs** (cron). Cambiar de mock a real solo toca la carpeta `collectors/`.

## Cómo ejecutar localmente

Requisitos: **Node 18+**.

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar entorno (ya hay un .env por defecto; o copia el ejemplo)
cp .env.example .env

# 3. Crear la base de datos + generar cliente + poblar datos demo
npm run setup        # = prisma generate && prisma db push && seed

# 4. Arrancar
npm run dev
# abre http://localhost:3000
```

Eso deja el dashboard con **5 ideas validadas**, cada una con score, evidencia y tendencias.

### Comandos útiles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción (incluye `prisma generate`) |
| `npm run db:seed` | Repuebla datos demo corriendo el pipeline |
| `npm run db:reset` | Reset total de la BD + seed |
| `npm run cron:collect` | Ejecuta el job de recolección (cada 6h) |
| `npm run cron:rank` | Ejecuta el job de ranking (diario) |

## Endpoints API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/ideas/today` | Top 5 oportunidades del día |
| GET | `/api/ideas/:id` | Detalle completo (evidencia, trend, score, guardado) |
| GET | `/api/ideas/history` | Todas las oportunidades + cambios de ranking |
| GET | `/api/signals` | Señales crudas (filtros: `source`, `category`, `minPain`, `limit`) |
| GET | `/api/sources/reddit` | Señales de Reddit |
| GET | `/api/sources/twitter` | Señales de X/Twitter |
| GET | `/api/sources/producthunt` | Productos abandonados con demanda residual |
| GET | `/api/trends` | Series de Google Trends |
| POST | `/api/ideas/:id/save` | Guardar/quitar de favoritos (`{ toggle }`) |
| POST | `/api/ideas/:id/status` | Estado: `research`/`validate`/`discard`/`build` |
| POST | `/api/ideas/:id/notes` | Guardar notas internas |
| GET/POST | `/api/cron/collect` | Job de recolección (protegido con `CRON_SECRET`) |
| GET/POST | `/api/cron/rank` | Job de ranking (protegido con `CRON_SECRET`) |

## Modelo de datos

`users`, `raw_signals`, `product_hunt_products`, `trends`, `opportunities`,
`opportunity_signals`, `saved_ideas` — definidos en `prisma/schema.prisma` exactamente como
en el brief. Los campos tipo lista se guardan como JSON para ser portables entre SQLite y
PostgreSQL.

### Cambiar a PostgreSQL

1. En `prisma/schema.prisma`, cambia `provider = "sqlite"` por `provider = "postgresql"`.
2. En `.env`, pon tu `DATABASE_URL` de Postgres.
3. `npm run db:push && npm run db:seed`.

## Motor de scoring (0–100)

El score final pondera 10 factores (`src/lib/scoring.ts`): cantidad de menciones, intención
de pago, nivel de dolor, engagement, crecimiento en Google Trends, falta de buenas
soluciones, demanda residual de productos abandonados, claridad de la audiencia, facilidad de
MVP y potencial B2B/B2C.

## Automatizaciones

- **Cada 6 horas** (`runCollection`): recolecta, normaliza, detecta intención de pago,
  calcula pain score y guarda señales.
- **Cada mañana** (`runRanking`): agrupa señales similares, cruza con Google Trends, calcula
  scores, genera el ranking y deja el top 5.

Para programarlas: usa `vercel.json` (incluido) en Vercel, o el `cron` del sistema con los
scripts `npm run cron:collect` / `npm run cron:rank`, o cualquier worker/cola.

## IA (opcional)

Por defecto el motor es 100% heurístico y funciona sin claves. Si pones `AI_ENABLED=true` y
`ANTHROPIC_API_KEY`, la capa `src/lib/ai.ts` usa Claude para afinar problema, MVP, modelo de
negocio y "por qué ahora" a partir de la evidencia. Si la llamada falla, cae al heurístico.

## Integraciones reales (desacopladas)

Cada collector en `src/lib/collectors/` tiene un `fetchReal()` listo para implementar y usa
mock solo si faltan credenciales. Variables en `.env.example`:
`REDDIT_CLIENT_ID/SECRET`, `TWITTER_BEARER_TOKEN`, `PRODUCTHUNT_TOKEN`, `TRENDS_PROVIDER_KEY`.
Respeta los términos de servicio y límites de cada API; nada de scraping no autorizado.

## Nota sobre los datos demo

Todos los datos de ejemplo (señales, tweets, productos, tendencias) están claramente marcados
como demo (p. ej. URLs con prefijo `demo_`). Las ideas se generan con el mismo pipeline que se
usaría en producción, sobre esa evidencia de ejemplo.
