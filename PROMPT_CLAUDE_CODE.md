# Prompt para Claude Code — Mejoras de Idea Radar

Eres un ingeniero full-stack senior trabajando sobre **Idea Radar**, una app Next.js 14 (App Router, TypeScript) que detecta oportunidades de startup a partir de señales de demanda (Reddit, X/Twitter, Product Hunt, Google Trends). Stack: Next.js + Prisma + PostgreSQL (Neon), Recharts, motor heurístico con hook de IA (Claude). Despliega en Vercel.

El proyecto está en la raíz del repo. Antes de tocar nada, lee `INFORME_MEJORAS.md` (auditoría completa) y explora `src/lib/pipeline.ts`, `src/lib/blueprints.ts`, `src/lib/scoring.ts`, `src/lib/collectors/*`, `prisma/schema.prisma` y `src/app`.

## Reglas de trabajo (obligatorias)
1. **No rompas el build.** Tras cada tarea corre `npx prisma generate && npx next build` y `npx tsc --noEmit`; todo debe pasar en verde antes de continuar.
2. **Mantén el fallback demo** de cada collector: si faltan credenciales, debe seguir funcionando sin claves.
3. **Postgres/Neon**: el provider de Prisma es `postgresql`. Para cambios de schema crea migraciones (`prisma migrate dev --name <x>`), no `db push`.
4. Trabaja por tarea, en commits pequeños con mensajes convencionales (`feat:`, `fix:`, `perf:`, `refactor:`). Una rama por tarea grande.
5. No introduzcas secretos en el código; usa variables de entorno y actualiza `.env.example`.
6. Respeta los términos de servicio de las APIs externas; nada de scraping no autorizado.
7. Cuando termines cada tarea, resume qué cambiaste, qué archivos tocaste y cómo verificarlo.

## Ya está hecho (NO lo rehagas)
- Auth de endpoints privilegiados con `src/lib/auth.ts` (`isAuthorized` fail-closed en producción; `refreshAllowed` con escape `ALLOW_PUBLIC_REFRESH`). `/api/admin/refresh`, `/api/cron/*` y `/api/seed` ya lo usan.
- Bugs corregidos: mapeo de respuesta del botón "Actualizar datos" (`page.tsx`), filtro roto en `reddit.ts`, enlace a la fuente real en el detalle de idea.
- N+1 eliminados en `pipeline.ts` (prefetch + `createMany`) y logging del pipeline (`[pipeline:collect]`, `[pipeline:rank]`, incluido `signalsUnclustered`).

## Tareas (en orden de prioridad)

### T1 — Autenticación real (email/password + magic link)
- Integra **Auth.js (NextAuth v5)** con el adaptador de Prisma.
- Amplía el modelo `User` (passwordHash, emailVerified) y añade los modelos que pida el adaptador (Account, Session, VerificationToken). Migración incluida.
- Implementa registro/login con email+password (hash con bcrypt/argon2) y, además, **magic link** por email (provider de Email).
- Reemplaza `getCurrentUser()` (`src/lib/user.ts`) por la sesión real; protege las páginas y los endpoints de mutación (`save`/`status`/`notes`) para que operen sobre el usuario autenticado. `SavedIdea` ya está modelado por `userId`.
- Añade páginas `/login` y `/signup` y un menú de sesión en `Nav`.
- Criterio de aceptación: dos usuarios distintos ven sus propios favoritos/notas; sin sesión no se puede guardar; build verde.

### T2 — Arreglar Product Hunt (detección de abandono real)
- En `src/lib/collectors/producthunt.ts`, el `fetchReal()` actual trae los más votados (`order: VOTES`) y deja `lastActivityDate=createdAt` y `recentReviewsAskingSupport=0`, así que la señal de "abandono con demanda residual" es 0 con datos reales.
- Reorienta a productos con **buena tracción histórica + inactividad**: usa los campos de fecha reales que exponga la API, añade un **health check** del sitio (HTTP HEAD/GET con timeout → up/down/parked) y, si es posible, conteo de comentarios/reviews recientes pidiendo soporte o alternativas.
- Si la API no expone "última actividad", documenta la limitación y aproxima con la señal disponible (no la dejes en 0).
- Criterio: con `PRODUCTHUNT_TOKEN` real, `abandonedScore` produce valores distintos de 0 y coherentes; fallback demo intacto.

### T3 — Paginación y caché en lecturas
- Pagina `/api/ideas/history` (cursor o take/skip) y ajusta el frontend de `history`/`favorites` para paginar/infinite-scroll.
- Añade caché de corta duración (Vercel KV o `unstable_cache`/`revalidate`) para `/api/ideas/today` e `history`.
- Evita el doble fetch de `/api/ideas/history` entre páginas (hook compartido).
- Criterio: history no carga todo de golpe; respuestas cacheadas con TTL; build verde.

### T4 — Modelo de datos: historial de ranking, índices, JSONB
- Crea modelo `RankingSnapshot(id, opportunityId, rank, finalScore, date)` y escríbelo en cada `runRanking` para no pisar el historial. Expón un endpoint/gráfico de evolución del score de una idea.
- Añade índices en `raw_signals.collected_at` y `raw_signals.source_url`.
- Migra los campos JSON-como-String (`scoreBreakdown`, `keywords`, `competitors`, `relatedQueries`, `series`) a tipo `Json` (JSONB) y actualiza `src/lib/json.ts`/serializadores.
- Añade flag `processed` o filtra por ventana temporal en `runRanking` para no re-procesar todo el histórico.
- Criterio: migraciones aplican; `runRanking` genera snapshots; build verde.

### T5 — Ideas generadas por IA por defecto (con fallback)
- Hoy las ideas (problema/MVP/modelo/"por qué ahora") salen de plantillas en `blueprints.ts` y la IA solo actúa si `AI_ENABLED=true`.
- Haz que `enrichOpportunity` se invoque siempre que haya `ANTHROPIC_API_KEY`, derivando los textos de la **evidencia real del cluster** (señales, trend, producto). Mantén el fallback heurístico si no hay clave o falla la llamada. Modelo configurable; usa Claude Haiku como opción económica.
- Criterio: con clave, los textos cambian según la evidencia; sin clave, sigue funcionando.

### T6 — Descubrimiento semántico (la mejora de mayor impacto)
- Sustituye/complementa el clustering por palabras clave (`bestBlueprint`) por **clustering semántico con embeddings**, para que las oportunidades **emerjan de los datos** en vez de limitarse a 7 plantillas fijas.
- Flujo: señales → embeddings (OpenAI/Voyage o modelo local) → clustering (HDBSCAN o BERTopic-like) → cada cluster es una oportunidad candidata → IA redacta los campos desde la evidencia del cluster → scoring con datos reales → ranking.
- Cachea los embeddings por señal (no recalcular). Mantén los blueprints como *seeds* opcionales, no como catálogo cerrado.
- Añade un parámetro de configuración para elegir motor (`keyword` | `semantic`) y degradar a keyword si no hay clave de embeddings.
- Criterio: con datos que no matchean ningún blueprint, el sistema produce clusters/oportunidades nuevas; `signalsUnclustered` baja drásticamente; build verde.

### T7 — Nuevas fuentes + Google Trends real
- Implementa `fetchReal()` para Google Trends vía un proveedor autorizado (SerpApi/DataForSEO) o `google-trends-api`, detrás de `TRENDS_PROVIDER_KEY`.
- Añade al menos una fuente nueva barata y rica en señal: **Hacker News** ("Ask HN", Algolia API) y/o **Indie Hackers**. Normalízalas al mismo formato de `CollectedPost`.
- Decide sobre X/Twitter: intégralo con proveedor de pago o quítalo de la UI para no prometer datos que no llegan.
- Criterio: con claves, llegan datos reales de Trends y de la nueva fuente; fallback demo intacto.

### T8 — Scoring: validación cruzada + explicabilidad + feedback
- Añade un factor de **validación cruzada**: nº de fuentes/subreddits distintos donde aparece el mismo dolor (métrica muy predictiva). Recalibra pesos en `scoring.ts` y documenta cada constante (hoy hay números mágicos `*26`, `*33`, `+50`).
- Mejora la explicabilidad del score en el detalle (qué señales impulsaron cada factor).
- Añade un mínimo **feedback loop**: que el usuario marque una idea como "buena/mala" y guarda esa señal para futura recalibración.
- Criterio: el desglose del score es interpretable; el factor de validación cruzada influye en el ranking; build verde.

## Definición de "hecho"
- `npx tsc --noEmit` y `npx next build` en verde tras cada tarea.
- `.env.example` actualizado con toda variable nueva.
- README actualizado (endpoints, variables, comandos).
- Cada PR/commit incluye cómo probarlo manualmente.
