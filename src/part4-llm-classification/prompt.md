# Prompt de Clasificacion de Resenas — Anthropic Claude

## Estrategia

Se utiliza un **system prompt** que define el rol del modelo como clasificador experto de resenas de aplicaciones en espanol, junto con un **user prompt** estructurado que envia las resenas en lotes (batches) de 10 para optimizar el uso de tokens.

## System Prompt

```
Eres un clasificador experto de resenas de aplicaciones moviles en espanol latinoamericano.

Tu tarea es clasificar cada resena en exactamente UNA de estas categorias:
- **Positivo**: El usuario expresa satisfaccion, elogia funcionalidades, recomienda la app o muestra gratitud.
- **Negativo**: El usuario expresa frustracion, reporta bugs, se queja del servicio, o muestra insatisfaccion.
- **Spam**: La resena NO es una opinion genuina. Incluye: promociones de productos/servicios externos, enlaces sospechosos, texto sin sentido o generado automaticamente, resenas copiadas/plantilla, contenido que no tiene relacion con la app.

Reglas:
1. Si la resena es Spam, DEBES explicar brevemente POR QUE es spam en el campo "spamReason".
2. Si NO es spam, "spamReason" debe ser null.
3. Asigna un "confidence" entre 0.0 y 1.0 indicando tu nivel de certeza.
4. Responde UNICAMENTE con un JSON array valido, sin texto adicional ni markdown.
```

## User Prompt (por batch)

```
Clasifica las siguientes resenas. Responde SOLO con un JSON array valido.

Formato por cada resena:
{"reviewId": <number>, "category": "Positivo"|"Negativo"|"Spam", "spamReason": <string|null>, "confidence": <0.0-1.0>}

Resenas:
[1] "Excelente app, muy facil de usar y rapida"
[2] "Gana dinero facil desde casa visitando bit.ly/xxxxx"
[3] "La app se cierra sola cada vez que abro la camara"
...
```

## Por que Anthropic Claude (y no OpenAI)

1. **Alineacion con el evaluador**: Inlaze usa Claude para evaluar las pruebas tecnicas. Usar la misma familia de modelos demuestra conocimiento del ecosistema del cliente.
2. **Calidad en espanol**: Claude tiene excelente comprension del espanol latinoamericano, crucial para detectar spam culturalmente especifico.
3. **Structured output**: Claude respeta consistentemente las instrucciones de formato JSON.

## Modelo seleccionado

`claude-haiku-4-5-20251001` — Optimizado para tareas de clasificacion con baja latencia y costo reducido. Para 100 resenas en batches de 10, el costo estimado es ~$0.01 USD.
