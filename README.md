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
- **Base de datos:** Prisma + **PostgreSQL** (Neon). Migraciones versionadas en `prisma/migrations/`.
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
npm run setup        # = prisma generate + migrate deploy + seed

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
| GET | `/api/ideas/today` | Top 5 oportunidades del día (cacheado, TTL 60s) |
| GET | `/api/ideas/:id` | Detalle completo (evidencia, trend, score, guardado) |
| GET | `/api/ideas/history` | Oportunidades paginadas por cursor (`?cursor=&take=&saved=true`); devuelve `{ ideas, nextCursor }` |
| GET | `/api/signals` | Señales crudas (filtros: `source`, `category`, `minPain`, `limit`) |
| GET | `/api/sources/reddit` | Señales de Reddit |
| GET | `/api/sources/twitter` | Señales de X/Twitter |
| GET | `/api/sources/producthunt` | Productos abandonados con demanda residual |
| GET | `/api/trends` | Series de Google Trends |
| POST | `/api/ideas/:id/save` | Guardar/quitar de favoritos (`{ toggle }`) |
| POST | `/api/ideas/:id/status` | Estado: `research`/`validate`/`discard`/`build` |
| POST | `/api/ideas/:id/notes` | Guardar notas internas |
| POST/DELETE | `/api/unlock` | Desbloquea (valida `APP_PASSWORD`, setea cookie) / bloquea |
| GET/POST | `/api/cron/collect` | Job de recolección (protegido con `CRON_SECRET`) |
| GET/POST | `/api/cron/rank` | Job de ranking (protegido con `CRON_SECRET`) |

### Lecturas: paginación y caché

- `history` se pagina por **cursor** (`take` por defecto 24, máx. 100). El frontend
  (dashboard, `/history`, `/favorites`) usa scroll infinito vía un hook compartido
  (`src/lib/useIdeasFeed.ts`) que **dedupe** el fetch entre páginas: el feed se
  trae una vez y se reutiliza al navegar.
- `today` e `history` cachean las oportunidades con `unstable_cache` (TTL 60s, tag
  `opportunities`); el estado `saved` por usuario se superpone fresco, nunca se
  cachea. `runRanking` / el refresh llaman `revalidateTag("opportunities")` para
  publicar el nuevo ranking al instante.
- `?saved=true` en `history` devuelve solo las ideas guardadas del usuario
  (paginadas), para que Favoritos no recorra todo el catálogo.

## Acceso (gate de un solo usuario)

La app es de uso personal: detrás de un único password compartido, no hay sistema
de usuarios ni registro. El flujo:

- `middleware.ts` bloquea toda la app y redirige a `/unlock` si no hay sesión válida.
- `/unlock` pide la clave; si coincide con `APP_PASSWORD`, setea una cookie httpOnly
  **firmada** (HMAC-SHA256, expira a 30 días) y entra. El botón **«Bloquear»** del
  `Nav` la borra.
- Si `APP_PASSWORD` está **vacía**, el gate queda **desactivado** (app abierta) —
  útil en local. Ponla en producción para proteger el demo.
- Los endpoints server-to-server (`/api/cron/*`, `/api/seed`, `/api/admin/refresh`)
  siguen protegidos por `CRON_SECRET` y **omiten** el gate al enviar el `Bearer`,
  así los crons (GitHub Actions / Vercel Cron) no se rompen.
- Opcional: `APP_SESSION_SECRET` firma la cookie de forma independiente del password.

## Modelo de datos

`users`, `raw_signals`, `product_hunt_products`, `trends`, `opportunities`,
`opportunity_signals`, `saved_ideas` — definidos en `prisma/schema.prisma` exactamente como
en el brief. Los campos tipo lista se guardan como JSON para ser portables entre SQLite y
PostgreSQL.

### Conexión a Neon (WebSocket / 443)

El cliente Prisma (`src/lib/db.ts`) usa el **driver serverless de Neon**
(`@prisma/adapter-neon` + `@neondatabase/serverless`, preview `driverAdapters`),
que habla Postgres **sobre WebSocket en el puerto 443**. Así la app funciona aunque
el puerto 5432 esté bloqueado (firewall/ISP/antivirus) y es el driver recomendado en
Vercel serverless. El **CLI de Prisma** (`migrate`, `studio`) sigue usando el 5432
directo, así que las migraciones se corren en el deploy o en una red sin bloqueo.

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

**Product Hunt — detección de abandono.** En modo real se buscan productos lanzados hace
9–36 meses ordenados por votos (tracción histórica + edad), se hace un *health check* HTTP del
sitio externo (`up`/`down`/`parked`/`unknown`) y se cuentan comentarios recientes pidiendo
soporte o alternativas. **Limitación:** la API v2 de Product Hunt no expone "última actividad"
de un producto, así que `lastActivityDate` se aproxima con la fecha del **comentario más
reciente** (fallback a `featuredAt`/`createdAt`). El cruce de un producto abandonado con una
oportunidad concreta todavía depende del catálogo de blueprints (`phProductName`); se generaliza
en la mejora de descubrimiento semántico (T6).

## Nota sobre los datos demo

Todos los datos de ejemplo (señales, tweets, productos, tendencias) están claramente marcados
como demo (p. ej. URLs con prefijo `demo_`). Las ideas se generan con el mismo pipeline que se
usaría en producción, sobre esa evidencia de ejemplo.

---

## 🚀 Deploy en Vercel + Neon

La app está configurada para **PostgreSQL** (`prisma/schema.prisma`) con migraciones
versionadas en `prisma/migrations/`. El `build` corre `prisma migrate deploy`
automáticamente, así que las tablas se crean solas en cada deploy.

### Pasos

1. **Crear la base en Neon** (https://neon.tech): crea un proyecto y copia el
   **connection string POOLED** (el host contiene `-pooler`), con `?sslmode=require`.

2. **Subir el repo a GitHub** e importarlo en Vercel (https://vercel.com/new).

3. **Variables de entorno en Vercel** (Settings → Environment Variables):
   - `DATABASE_URL` = tu connection string de Neon (pooled).
   - `CRON_SECRET` = una cadena larga aleatoria.
   - `APP_PASSWORD` = la clave de acceso a la app (sin ella, el demo queda abierto).
   - (Opcional) `AI_ENABLED=true` + `ANTHROPIC_API_KEY` para enriquecer ideas con IA.
   - (Opcional) claves reales de Reddit/X/Product Hunt.

4. **Deploy.** En el build, `prisma migrate deploy` crea las 7 tablas en Neon.

5. **Cargar datos demo una vez** (endpoint protegido):
   ```bash
   curl -X POST -H "Authorization: Bearer <TU_CRON_SECRET>" \
     https://<tu-app>.vercel.app/api/seed
   ```
   Listo: el dashboard muestra las 5 ideas. (También puedes correr el seed en local
   apuntando `DATABASE_URL` a Neon: `npm run db:seed`.)

### Jobs programados en Vercel

`vercel.json` ya define los cron: `/api/cron/collect` cada 6 h y `/api/cron/rank`
cada mañana (7:00). Vercel envía `Authorization: Bearer <CRON_SECRET>` y el código
lo valida. **Nota:** en el plan **Hobby** los cron se ejecutan como máximo 1 vez al
día; para la cadencia de cada 6 h necesitas plan **Pro**.

### Notas

- Para **local dev** con este setup, apunta `DATABASE_URL` a una base Postgres
  (un proyecto gratis de Neon sirve también para local) y corre `npm run setup`.
- La versión de Next está fijada en una release parcheada (14.2.35).
