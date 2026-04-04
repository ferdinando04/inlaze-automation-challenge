# Inlaze Automation Challenge

Prueba tecnica para **Desarrollador de Automatizaciones e IA** en [Inlaze](https://inlaze.com) — empresa colombiana de iGaming y Performance Marketing.

**Autor:** Fernando Vega Benavides — [fernando@vegadev.co](mailto:fernando@vegadev.co) | [LinkedIn](https://www.linkedin.com/in/fernando-vega04/) | [GitHub](https://github.com/ferdinando04)

---

## Requisitos previos

| Herramienta | Version minima |
|-------------|---------------|
| Node.js     | 20+           |
| npm         | 9+            |
| n8n         | 1.x (opcional, para Part 2) |

## Quick Start

```bash
# 1. Clonar el repositorio
git clone https://github.com/ferdinando04/inlaze-automation-challenge.git
cd inlaze-automation-challenge

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tu ANTHROPIC_API_KEY (requerido para Part 4)

# 4. Inicializar la base de datos (SQLite via Prisma)
npx prisma migrate dev

# 5. Ejecutar todos los tests
npm test
```

**Resultado esperado:** 44 tests passing across 6 test files.

---

## Estructura del Proyecto

```
inlaze-automation-challenge/
├── src/
│   ├── shared/
│   │   ├── logger.ts              # Structured JSON logger
│   │   └── config.ts              # Env vars loader with validation
│   ├── part1-api-integration/
│   │   ├── types.ts               # CampaignReport, ClassifiedReport, RetryConfig
│   │   ├── api-client.ts          # HTTP client + exponential backoff retry
│   │   ├── classifier.ts          # metric -> critical/warning/ok
│   │   ├── storage.ts             # Save/load results to JSON
│   │   ├── index.ts               # Orchestrator entry point
│   │   └── __tests__/             # 22 unit tests
│   ├── part3-debugging/
│   │   ├── original-buggy.ts      # Snippet original (NO TOCAR)
│   │   ├── fixed.ts               # Version corregida con comentarios
│   │   └── __tests__/             # 7 tests
│   ├── part3-prisma/
│   │   ├── worst-roas-query.ts    # Prisma groupBy + avg ROAS query
│   │   └── __tests__/             # 3 integration tests (SQLite real)
│   └── part4-llm-classification/
│       ├── types.ts               # LLMSummary interface
│       ├── classifier.ts          # Anthropic Claude campaign summary generator
│       ├── prompt.md              # Prompt documentado con estrategia
│       ├── index.ts               # Entry point
│       └── __tests__/             # 5 unit tests
├── n8n/
│   └── campaign-alert-workflow.json  # Exported workflow (JSON, NO screenshot)
├── prisma/
│   └── schema.prisma              # Operator + Campaign + CampaignMetric models
├── .env.example
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Ejecucion por Parte

### Part 1 — API Integration (TypeScript/Node.js)

```bash
npx tsx src/part1-api-integration/index.ts
```

**Que hace:** Consume una API REST externa, transforma la respuesta en objetos tipados `CampaignReport`, clasifica cada campana por su metrica ROAS:

| Metrica   | Status   | Accion requerida        |
|-----------|----------|------------------------|
| < 1.0     | critical | Atencion inmediata     |
| < 2.5     | warning  | Monitoreo activo       |
| >= 2.5    | ok       | Sin accion             |

**Retry con Backoff Exponencial:**

```
Intento 1: falla -> espera 1s * jitter
Intento 2: falla -> espera 2s * jitter
Intento 3: falla -> espera 4s * jitter (cap: 30s)
Intento 4: falla -> throw error
```

El jitter (factor aleatorio 0.5x-1.5x) previene el "thundering herd" — multiples clientes reintentando al mismo tiempo contra un servidor caido.

**Output:** `output/campaign-results.json` con reportes clasificados + resumen.

---

### Part 2 — n8n Workflow Automation

**Importar en n8n:**
1. Abrir n8n (local: `npx n8n` o cloud)
2. Menu -> Import from File -> seleccionar `n8n/campaign-alert-workflow.json`
3. Configurar la variable `DISCORD_WEBHOOK_URL` en n8n Settings -> Variables

**Arquitectura del workflow:**

```
[Webhook POST /campaign-alerts]
         |
   [Switch: status]
    /       |       \
critical  warning    ok
   |        |        |
Discord   HTTP     No-Op
(embed)  (Sheets)
   |        |        |
[Respond] [Respond] [Respond]

[Error Trigger] -> [Code: Error Logger]
```

**Nodos:**
- **Webhook Trigger:** Recibe POST con datos de campana clasificada
- **Switch:** Rutea por `status` (critical/warning/ok)
- **Discord Critical Alert:** Envia embed rojo con metricas al webhook de Discord
- **Google Sheets (Simulated):** POST a httpbin.org simulando append a Google Sheet
- **OK — No Action:** No-op para campanas saludables
- **Error Trigger + Error Logger:** Captura errores de cualquier nodo y los registra en formato estructurado SIN detener la ejecucion

**Probar manualmente:**
```bash
curl -X POST http://localhost:5678/webhook/campaign-alerts \
  -H "Content-Type: application/json" \
  -d '{
    "id": "camp-001",
    "name": "Summer Sale LATAM",
    "metric": 0.4,
    "spend": 5000,
    "revenue": 2000,
    "status": "critical",
    "reportDate": "2026-04-01"
  }'
```

---

### Part 3A — Debugging

**Archivo original:** `src/part3-debugging/original-buggy.ts` (intacto)
**Archivo corregido:** `src/part3-debugging/fixed.ts`

#### Bug #1: Division por Cero en `calculateCTR()`

**Problema:** `campaign.clicks / campaign.impressions` produce `Infinity` cuando impressions = 0, y `NaN` cuando ambos son 0. Estos valores invalidos se propagan silenciosamente corrompiendo reportes.

**Fix:** Guard clause antes de la division:
```typescript
if (campaign.impressions === 0) {
  return { id: campaign.id, ctr: 0 };
}
```

#### Bug #2: Ejecucion Secuencial en `processAllCampaigns()`

**Problema:** El loop `for...of` con `await` procesa cada campana una a una. Con N campanas a ~100ms cada una: tiempo total = N * 100ms.

**Fix:** `Promise.all()` para ejecucion paralela:
```typescript
const allData = await Promise.all(ids.map(id => fetchCampaignData(id)));
return allData.map(calculateCTR);
```

**Impacto:** Para 100 campanas: ~100ms (paralelo) vs ~10,000ms (secuencial).

---

### Part 3B — Prisma ORM Query

```bash
# La base de datos se inicializa con prisma migrate dev
npx prisma migrate dev
```

**Schema:** Tres modelos — `Operator`, `Campaign` y `CampaignMetric` (metricas de rendimiento como serie temporal).

```
Operator (1) ──── (*) Campaign (1) ──── (*) CampaignMetric
  id                    id                      id
  name                  name                    roas
  campaigns[]           operatorId              campaignId
                        metrics[]               recordedAt
```

**Query: Peor ROAS por Operador (ultimos 7 dias)**

La funcion `getWorstRoasByOperator()`:

1. **Filtra** `CampaignMetric` donde `recordedAt >= 7 dias atras`
2. **Agrupa** por operador navegando `CampaignMetric → Campaign → Operator`
3. **Calcula** promedio de `roas` por operador
4. **Ordena** por ROAS promedio ascendente (peores primero)
5. **Enriquece** con nombres de operadores en una segunda query

**Por que importa en iGaming:** Operadores con ROAS consistentemente bajo estan quemando presupuesto publicitario. Esta query los identifica para revision del equipo de performance marketing.

---

### Part 4 — LLM Campaign Summary

```bash
# Requiere ANTHROPIC_API_KEY en .env
npx tsx src/part4-llm-classification/index.ts
```

**Que hace:** Recibe el JSON de `output/classified-reports.json` (resultados de la Parte 1) y genera un resumen ejecutivo en lenguaje natural usando Anthropic Claude.

**Funcion principal:**

```typescript
async function generateCampaignSummary(
  reports: CampaignReport[]
): Promise<LLMSummary>
```

**Tipo retornado:**

```typescript
interface LLMSummary {
  generatedAt: Date;
  model: string;
  summary: string;
  rawResponse?: unknown;
}
```

**Modelo:** `claude-haiku-4-5-20251001` — seleccionado por bajo costo y alta velocidad.

**El prompt instruye al LLM a:**
- Identificar y destacar por nombre y metrica las campanas en estado `critical`
- Resumir el estado general de las campanas en `warning`
- Sugerir al menos una accion concreta basada en los datos
- Responder en espanol, en formato de resumen ejecutivo (max 150 palabras)

**Error handling:** Si el LLM no responde o lanza excepcion, el error se captura, se loguea con el logger estructurado, y se lanza un `Error` descriptivo. El sistema nunca falla silenciosamente.

**Output:** `output/llm-summary.json`

**Prompt completo documentado en:** `src/part4-llm-classification/prompt.md`

---

## Tests

```bash
# Ejecutar todos los tests
npm test

# Ejecutar con watch mode
npm run test:watch

# Tests por parte
npx vitest run src/part1-api-integration/
npx vitest run src/part3-debugging/
npx vitest run src/part3-prisma/
npx vitest run src/part4-llm-classification/
```

**Cobertura actual:** 44 tests, 6 test files, 100% passing.

| Modulo | Tests | Tipo |
|--------|-------|------|
| Part 1 — Classifier | 15 | Unit |
| Part 1 — API Client | 8 | Unit (mocked HTTP) |
| Part 1 — Storage | 6 | Unit (filesystem) |
| Part 3A — Debugging | 7 | Unit |
| Part 3B — Prisma | 3 | Integration (SQLite real) |
| Part 4 — LLM Summary | 5 | Unit (mocked Anthropic, valida LLMSummary) |

---

## Decisiones Tecnicas

### TypeScript Strict Mode
Todas las comprobaciones habilitadas (`strict: true`, `noUncheckedIndexedAccess: true`). Cero uso de `any`. Los tipos son interfaces explicitadas, no inferencias.

### Structured Logging
Ningun `console.log` directo. Todos los logs pasan por `createLogger()` que produce JSON estructurado con timestamp, nivel, contexto y datos. Compatible con herramientas de agregacion (Datadog, Grafana Loki).

### Test-Driven Development
Cada modulo se desarrollo siguiendo TDD estricto: RED (test falla) -> GREEN (implementacion minima) -> REFACTOR. Los tests de Prisma usan SQLite real, no mocks.

### Exponential Backoff con Jitter
No es un delay fijo entre reintentos. El backoff crece exponencialmente (1s, 2s, 4s...) con un multiplicador aleatorio (jitter) que previene tormentas de reintentos sincronizados.

### n8n Error Handling
El Error Trigger captura fallos sin detener el workflow. En iGaming, donde las alertas de campanas son criticas, un error en un nodo no debe bloquear el procesamiento de otras campanas.

---

## Mejoras Futuras

- **Rate limiting adaptativo** en el cliente API basado en headers `Retry-After`
- **Cache de resumenes LLM** para evitar re-generar resumenes con datos identicos
- **Dashboard en tiempo real** conectado al webhook de n8n para visualizar alertas
- **Prisma con PostgreSQL** en produccion en lugar de SQLite
- **CI/CD pipeline** con GitHub Actions para lint + test en cada PR
- **Monitoring** con metricas de latencia de generacion de resumenes LLM
- **Dead letter queue** en n8n para reintentar alertas fallidas de Discord

---

## Licencia

MIT

---

*Desarrollado con TypeScript, Vitest, Prisma, Anthropic Claude y n8n.*
*Prueba tecnica Inlaze — Abril 2026*
