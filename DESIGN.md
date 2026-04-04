# Diseño: Agente de IA para Gestión Automática de Campañas

## Arquitectura del Sistema

El sistema tiene tres capas: un LLM como orquestador, una base de datos de métricas, y un loop ReAct (Reason → Act → Observe) que permite al agente tomar decisiones iterativas.

## Tools del Agente

El agente dispone de tres herramientas concretas:

- **queryWorstCampaigns(days: number):** consulta métricas de ROAS desde la base de datos, filtrando por ventana temporal.
- **pauseCampaign(id: string):** pausa una campaña específica invocando la API del ad server.
- **sendAlert(channel: string, payload: object):** envía notificaciones a Discord, Slack o email.

## Lógica de Decisión

El agente ejecuta ciclos autónomos: consulta métricas → evalúa contra umbrales definidos → decide si pausar, alertar o escalar → invoca la tool correspondiente → observa el resultado → repite si es necesario.

## Auditabilidad

Cada ciclo genera un registro inmutable con agentRunId, tool invocada, input, output, decisión tomada y timestamp. Ninguna acción automática ocurre sin este log, garantizando trazabilidad completa.

## Agente vs Script Determinista

La diferencia clave es que un script sigue reglas fijas (if/else), mientras que el agente razona sobre contexto, combina múltiples tools dinámicamente y adapta su plan según los resultados observados en cada iteración.
