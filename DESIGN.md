# Diseño: Agente de IA para Gestión Automática de Campañas

## Arquitectura

El sistema tiene tres capas: un LLM orquestador con tool-calling, una base de datos de métricas, y un loop ReAct (Reason → Act → Observe → Repeat) que permite decisiones iterativas.

```
[CampaignData] → [fetch_campaigns] → [LLM ReAct Loop]
                                            |
                    ┌───────────────────────┤
                    ↓                       ↓
            [classify_campaign]      [get_history]
                    |                       |
                    └───────────┬───────────┘
                                ↓
                    [send_alert / log_action]
                                ↓
                    [Audit Log: qué hizo, por qué, cuándo]
```

## Tools del Agente

Mediante tool-calling, el LLM invoca herramientas concretas:

- **queryWorstCampaigns(days):** consulta ROAS desde la base de datos.
- **pauseCampaign(id):** pausa una campaña vía API del ad server.
- **sendAlert(channel, payload):** notifica a Discord, Slack o email.

## Lógica de Decisión

El agente ejecuta el loop Reason → Act → Observe → Repeat: consulta métricas, evalúa contra umbrales, decide si pausar o alertar, invoca la tool correspondiente, observa el resultado y repite si es necesario.

## Auditabilidad

Cada tool call genera un registro inmutable con agentRunId, tool invocada, input, output, decisión y timestamp. Ninguna acción ocurre sin este log.

## Agente vs Script

Un script sigue reglas fijas (if/else). El agente razona sobre contexto, combina tools mediante tool-calling y adapta su plan según resultados observados.
