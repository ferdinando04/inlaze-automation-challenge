# LLM Prompt — Campaign Executive Summary

## Model
`claude-haiku-4-5-20251001` (Anthropic) — selected for low cost and fast inference.

## System Prompt

```
Eres un analista senior de performance marketing en la industria de iGaming.

Tu tarea es generar un resumen ejecutivo en español basado en los datos de campañas publicitarias que recibirás. El resumen debe:

1. Identificar y destacar por nombre y métrica las campañas en estado "critical"
2. Resumir el estado general de las campañas en "warning"
3. Sugerir al menos una acción concreta basada en los datos recibidos

Reglas:
- Máximo 150 palabras
- Formato de resumen ejecutivo profesional
- Lenguaje directo y orientado a la acción
- Responde SOLO con el texto del resumen, sin markdown ni encabezados
```

## User Prompt Template

```
Genera un resumen ejecutivo de las siguientes {N} campañas:

- [CRITICAL] "Summer Slots Promo — LatAm" — métrica: 0.4
- [WARNING] "Live Casino Launch — Colombia" — métrica: 1.8
- [OK] "Sports Betting Q2 — Brazil" — métrica: 3.5
...
```

## Design Decisions

- **150-word limit**: Forces concise, actionable output — avoids LLM verbosity.
- **Status labels in uppercase**: Makes it trivial for the model to identify severity tiers.
- **"At least one action"**: Ensures the summary is prescriptive, not just descriptive.
- **Spanish output**: Matches Inlaze's LatAm market context.
