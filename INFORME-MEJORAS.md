# Idea Radar — Auditoría profunda e informe de mejoras

_Fecha: junio 2026 · Alcance: código actual en `idea-radar/` + benchmark con productos reales del mercado._

---

## 1. Resumen ejecutivo

Idea Radar es un MVP **sólido como demo**: arquitectura limpia y por capas, pipeline real (collect → cluster → score → rank), datos demo que funcionan sin claves, e integraciones reales ya empezadas (Reddit OAuth y Product Hunt GraphQL). Compila, despliega y se ve profesional.

Pero como **producto** tiene tres límites de fondo que hoy lo separan de herramientas como GummySearch o IdeaBrowser:

1. **El motor solo "descubre" 7 oportunidades fijas.** Las ideas no emergen de los datos: están escritas a mano en `blueprints.ts` y el sistema solo hace _match_ de palabras clave contra esas 7 plantillas. Si la demanda real apunta a algo nuevo, el sistema no lo ve.
2. **No hay autenticación real.** Todos los usuarios comparten una cuenta demo hardcodeada. No se puede lanzar multiusuario tal como está.
3. **Endpoints de escritura abiertos.** `/api/admin/refresh` (que dispara todo el pipeline) no tiene ninguna protección, y `/api/seed` / `/api/cron/*` quedan abiertos si falta `CRON_SECRET`.

El resto del informe detalla estos puntos, lista bugs concretos con archivo:línea, y propone un **roadmap priorizado por impacto/esfuerzo**. La buena noticia: la base está bien hecha, así que casi todas las mejoras son aditivas, no reescrituras.

**Veredicto:** excelente esqueleto, listo para evolucionar de "demo bonita" a "producto que descubre demanda real".

---

## 2. Hallazgos críticos (arreglar primero)

### Seguridad

| # | Archivo | Problema | Riesgo |
|---|---------|----------|--------|
| S1 | `src/app/api/admin/refresh/route.ts` | Sin ninguna autorización. Cualquiera puede `POST` y disparar el pipeline completo (caro, abusable como DoS). | **Crítico** |
| S2 | `src/app/api/cron/collect`, `cron/rank`, `seed` | Si `CRON_SECRET` no está seteada, el chequeo `if (!secret) return true` deja el endpoint **abierto**. `/api/seed` puede **borrar y repoblar toda la BD**. | **Crítico** |
| S3 | `src/lib/user.ts` | `getCurrentUser()` devuelve siempre el usuario demo. No hay login, sesión ni separación por usuario. | **Crítico** (bloquea multiusuario) |
| S4 | endpoints `save`/`status`/`notes` | POST sin verificación de origen/CSRF ni validación de `Content-Type`. | Medio |

> **Fix rápido S1/S2:** que `/api/admin/refresh` exija el mismo `Bearer CRON_SECRET`, y cambiar los chequeos a **fail-closed** en producción: `if (!secret && NODE_ENV==='production') return false`.

### Bugs de correctitud

| # | Archivo:línea | Problema |
|---|---------------|----------|
| B1 | `src/app/page.tsx:37` | El botón "Actualizar datos" lee `data.collected.signalsInserted` y `data.ranked.ideasUpserted`, pero el endpoint no devuelve esas claves → siempre muestra **"undefined señales, undefined ideas"**. |
| B2 | `src/lib/collectors/reddit.ts:93` | El filtro de rotación demo es `i % 3 !== offset || true` → el `|| true` lo anula, **nunca rota** los posts. |
| B3 | `src/lib/collectors/producthunt.ts` (`fetchReal`) | La query trae los productos **más votados** (`order: VOTES`), no productos **abandonados**. Además `lastActivityDate = createdAt` y `recentReviewsAskingSupport = 0`, así que en modo real la señal de "abandono con demanda residual" queda en cero. **El feature estrella de PH no funciona con datos reales.** |
| B4 | `src/app/idea/[id]/page.tsx` (evidencia) | Cada señal muestra "demo source ↗" en vez de enlazar al post real de Reddit/X. Resta credibilidad incluso con datos reales. |

---

## 3. El problema de fondo: descubrimiento vs. catálogo fijo

Hoy el "motor de IA" es, en realidad, un **clasificador por palabras clave contra 7 plantillas** (`blueprints.ts` + `bestBlueprint()`):

- Las ideas (problema, MVP, modelo de negocio, "por qué ahora") están **escritas a mano** en cada blueprint. La capa de IA (`ai.ts`) solo las reescribe si `AI_ENABLED=true`; por defecto se muestran tal cual.
- El _clustering_ es `text.includes(keyword)`: un post sobre "la API de invoices de Stripe" cae en el blueprint "invoice-chaser" aunque no hable de cobranza. **Cero comprensión semántica.**
- Si los datos reales no contienen esas palabras exactas, las señales se **descartan en silencio** (no hay log de cuántas se pierden).

### Cómo lo hacen los productos líderes

- **GummySearch** hace _audience research_ sobre **130.000 comunidades de Reddit** y deja que los temas/pain points **emerjan** de las conversaciones, no de una lista fija.
- **IdeaBrowser** publica una "idea del día" y corre un **agente de investigación de 40 pasos** que puntúa cada idea por _problem severity, feasibility, timing, market value y moat_, aplicando frameworks conocidos (Dream 100, ACP de Greg Isenberg).
- Práctica estándar de validación en Reddit: **comunidades nicho > amplias** (r/microsaas con 50K convierte mejor que r/Entrepreneur con 3.2M), **queries problema-primero** ("wish there was a tool that…"), y la regla de oro: _un mismo dolor en **5+ subreddits** con **50+ upvotes** cada uno = problema validado_.

### La mejora clave

Reemplazar (o complementar) el _matching_ por palabras clave con **clustering semántico por embeddings**. Los embeddings agrupan textos por significado aunque usen vocabulario distinto, y **descubren categorías nuevas sin etiquetas predefinidas** — exactamente lo que falta. BERTopic / sBERT son el estándar para esto.

Flujo propuesto:

```
señales → embedding (OpenAI/Voyage/local) → clustering (HDBSCAN/BERTopic)
        → cada cluster = oportunidad candidata
        → IA (Claude) redacta problema/MVP/modelo desde la evidencia del cluster
        → scoring con datos reales del cluster + Google Trends
        → ranking
```

Así las ideas **emergen de la demanda**, y los blueprints pasan de ser "el catálogo" a ser solo _seeds_ opcionales.

---

## 4. Mejoras por área

### 4.1 Motor y scoring

- **Discovery dinámico** (ver §3): embeddings + clustering no supervisado. Es el mayor salto de valor.
- **Ideas generadas, no plantillas.** Que la redacción de problema/MVP/modelo/"por qué ahora" salga **siempre** de la IA a partir de la evidencia del cluster (con _fallback_ heurístico). Hoy la IA es opcional y casi nadie la activará.
- **Scoring explicable y calibrado.** Los pesos y constantes en `scoring.ts` (`* 26`, `* 33`, `+ 50`) son números mágicos sin justificación. Recomendado:
  - Documentar cada factor y su rango esperado.
  - Añadir un factor **"validación cruzada"**: nº de subreddits/fuentes distintas donde aparece el dolor (la métrica más predictiva según el mercado).
  - Guardar el `scoreBreakdown` como **JSONB** (hoy es `String`) para poder filtrar/ordenar por factor.
  - A futuro: _feedback loop_ ("¿esta idea llevó a un producto real?") para recalibrar pesos.
- **No descartar señales en silencio.** Loguear cuántas señales no caen en ningún cluster; son materia prima de oportunidades nuevas.

### 4.2 Integraciones (collectors)

- **Product Hunt (B3):** cambiar el enfoque. Para "productos abandonados con demanda residual" no sirve `order: VOTES`. Buscar productos con buena votación histórica + **último update antiguo**, cruzar con un _health check_ del sitio (HTTP status), y leer comentarios recientes pidiendo soporte/alternativas. Si la API no expone "última actividad", marcar honestamente la limitación.
- **Twitter/X:** hoy `fetchReal()` devuelve `[]` (la API de X es de pago). Decidir: (a) integrar un proveedor autorizado, (b) sustituir por una fuente más barata con señal similar (Hacker News "Ask HN", Indie Hackers, foros), o (c) quitar X de la UI para no prometer datos que no llegan.
- **Google Trends:** sin API oficial; integrar un proveedor (SerpApi, DataForSEO) o la librería `google-trends-api` detrás del `fetchReal()`. Hoy es 100% demo.
- **Observabilidad:** los `catch { return [] }` esconden fallos de credenciales. Logging estructurado: "Reddit: 342 señales / PH: 0 (token inválido)".

### 4.3 Modelo de datos (`schema.prisma`)

- **Auth:** la tabla `User` solo tiene `name`/`email`. Faltan `passwordHash`, `emailVerified`, `magicLinkToken`/`expires`, o `oauthId`. Sin esto no hay login real.
- **Historial de ranking:** hoy solo guardas `rank`/`previousRank` en la propia oportunidad → cada re-ranking **pisa** el dato. Añadir `RankingSnapshot(opportunityId, rank, finalScore, date)` para graficar "cómo se movió la idea #3 en 30 días".
- **Índices:** añadir índice en `raw_signals.collected_at` (ventana temporal) y en `source_url` (dedupe). Hoy solo hay en `source` y `category`.
- **Campos JSON:** migrar `scoreBreakdown` y similares de `String` a `Json` (JSONB) en Postgres.
- **`processed` flag en señales:** para no re-procesar todo el histórico en cada `runRanking` (ver §4.6).

### 4.4 Autenticación y multiusuario

- Implementar **Auth.js (NextAuth)** con email/password + magic link (lo que pedía el brief). Encaja con Next 14 y Prisma con adaptador oficial.
- Reemplazar `getCurrentUser()` por la sesión real; `SavedIdea` ya está modelado por `userId`, así que el multiusuario "casi sale solo" una vez haya sesión.
- Proteger `/api/admin/*` por rol (solo admin) además del secreto.

### 4.5 Frontend / UX

- **B1:** alinear la respuesta de `/api/admin/refresh` con lo que lee `page.tsx`. Mostrar conteos reales.
- **B4:** enlazar la evidencia al post real (`sourceUrl`) en vez de "demo source ↗".
- **Estados de error/carga:** hoy si la API falla se ve "no hay ideas" (indistinguible de vacío real). Añadir _error boundary_ + reintento.
- **Acción de validación** (lo que hace GummySearch): botón "contactar al autor" / copiar un mensaje de _outreach_ para entrevistas. Convierte la app de "lectura" a "acción".
- **Export/compartir:** CSV/PDF de una idea o de la lista, y link compartible para cofundadores.
- **i18n:** la UI está hardcodeada en español (`es-ES`) y el motor solo entiende inglés. Separar copy de lógica si el público es bilingüe.

### 4.6 Performance / escalabilidad

- **N+1 queries** en `pipeline.ts`: hay `await prisma.*.findFirst()` dentro de loops en `runCollection` (señales, productos, trends) y en el loop de clustering (trend/product por cluster). Con miles de señales esto explota. → Cargar todo una vez con `findMany` y resolver en memoria (Sets/Maps).
- **`runRanking` re-lee TODAS las señales** cada vez (`findMany()` sin filtro). → Procesar solo las últimas 24–48 h o usar el flag `processed`.
- **Sin paginación** en `/api/ideas/history` (devuelve todo). → Paginar (take/skip o cursor).
- **Sin caché.** Top-5 e historial se recomputan en cada request. → Vercel KV/Redis con TTL corto, o `revalidate`.

### 4.7 Calidad de NLP

- `extractKeywords()` cuenta frecuencias sin _stemming_: "invoice" e "invoices" se cuentan aparte. → stemming/lematización o, mejor, embeddings (§3).
- Stopwords solo en inglés pese a existir el campo `language`. → multilenguaje si se procesan señales en español.
- Sin filtro de spam/bots/autopromoción. → heurística o clasificador de "¿es un pain point genuino?".

---

## 5. Benchmark rápido vs. el mercado

| Capacidad | Idea Radar (hoy) | GummySearch | IdeaBrowser |
|---|---|---|---|
| Fuente de señales | Reddit real + demo | 130K comunidades Reddit | Multi-fuente + trends |
| Descubrimiento | **7 ideas fijas** | Temas emergentes | Idea del día (IA) |
| Scoring | 10 factores heurísticos | Insights de comunidad | Score multi-dimensión + 40 pasos IA |
| Validación accionable | No | DM a autores, entrevistas | Plan go-to-market |
| Auth/multiusuario | **No** | Sí | Sí |
| Precio referencia | — | ~$49–79/mes | freemium |

Lo que más te diferenciaría hoy: **descubrimiento dinámico real** (no catálogo fijo) + **acciones de validación** (contactar fuentes), que son justo las dos cosas por las que la gente paga estas herramientas.

---

## 6. Roadmap priorizado

### Quick wins (1–2 días, alto impacto / bajo esfuerzo)
1. Proteger `/api/admin/refresh` con `CRON_SECRET` y hacer los cron/seed **fail-closed** en producción. (S1, S2)
2. Arreglar el mapeo de respuesta del botón "Actualizar datos". (B1)
3. Arreglar el filtro roto `|| true` en Reddit demo. (B2)
4. Enlazar la evidencia al `sourceUrl` real. (B4)
5. Eliminar los N+1 en `pipeline.ts` (cargar con `findMany` una vez). (perf)
6. Añadir logging del pipeline (cuántas señales / clusters / descartadas).

### Medio plazo (1–2 semanas, alto impacto)
7. **Auth real** con Auth.js (email/password + magic link) y `getCurrentUser()` por sesión. (S3)
8. **Arreglar Product Hunt** para detectar abandono real (último update + health check). (B3)
9. Paginación + caché en endpoints de lectura.
10. Tabla `RankingSnapshot` + índices nuevos + `scoreBreakdown` como JSONB.
11. Forzar generación de ideas por IA con _fallback_ (no plantillas por defecto).

### Apuestas grandes (donde está el verdadero valor)
12. **Descubrimiento semántico** con embeddings + clustering (BERTopic/HDBSCAN). Convierte Idea Radar en un buscador de oportunidades de verdad. (§3)
13. **Acciones de validación**: outreach a autores, export, compartir.
14. Nuevas fuentes (Hacker News, Indie Hackers) y Google Trends real.
15. Factor de **validación cruzada** (mismo dolor en N fuentes) + _feedback loop_ de scoring.

---

## 7. Fuentes

- GummySearch — validación de ideas y audience research: https://gummysearch.com/insights/idea-validation/ · https://gummysearch.com/how-to/validate-your-idea/
- IdeaBrowser — idea del día y framework de scores: https://www.ideabrowser.com/idea-of-the-day · https://www.ideabrowser.com/features?feature=idea-scores
- Comparativa de herramientas: https://medium.com/@rajanikethreddy/4-tools-that-find-your-next-startup-idea-so-you-dont-have-to-scroll-reddit-for-hours-fe1e1dc2584c
- Metodología de validación en Reddit: https://reddinbox.com/blog/how-to-validate-startup-ideas-on-reddit · https://signal-hunt.com/ · https://www.painbase.space/blog/how-to-use-reddit-to-validate-startup-ideas
- Clustering semántico con embeddings vs keyword matching: https://palospublishing.com/using-embeddings-to-cluster-customer-complaints/ · https://medium.com/@mahasris0304/understanding-semantic-search-and-clustering-a-complete-guide-76e51cf6313d
