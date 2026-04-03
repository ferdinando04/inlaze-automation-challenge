/**
 * LLM-powered review classification using Anthropic Claude.
 *
 * Classifies app reviews in Spanish into three categories:
 * - Positivo: Genuine positive feedback
 * - Negativo: Genuine negative feedback
 * - Spam: Non-genuine content (with mandatory explanation)
 *
 * Uses claude-haiku-4-5-20251001 for cost-efficient batch classification.
 * Reviews are sent in batches of 10 to optimize token usage.
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  AppReview,
  ReviewClassification,
  ClassificationBatchResult,
} from "./types";
import { config } from "../shared/config";
import { createLogger } from "../shared/logger";

const logger = createLogger("llm-classifier");

const MODEL = "claude-haiku-4-5-20251001";
const BATCH_SIZE = 10;

/**
 * System prompt that defines Claude's role as a review classifier.
 * Carefully structured to ensure consistent JSON output and
 * mandatory spam explanations.
 */
const SYSTEM_PROMPT = `Eres un clasificador experto de resenas de aplicaciones moviles en espanol latinoamericano.

Tu tarea es clasificar cada resena en exactamente UNA de estas categorias:
- **Positivo**: El usuario expresa satisfaccion, elogia funcionalidades, recomienda la app o muestra gratitud.
- **Negativo**: El usuario expresa frustracion, reporta bugs, se queja del servicio, o muestra insatisfaccion.
- **Spam**: La resena NO es una opinion genuina. Incluye: promociones de productos/servicios externos, enlaces sospechosos, texto sin sentido o generado automaticamente, resenas copiadas/plantilla, contenido que no tiene relacion con la app.

Reglas:
1. Si la resena es Spam, DEBES explicar brevemente POR QUE es spam en el campo "spamReason".
2. Si NO es spam, "spamReason" debe ser null.
3. Asigna un "confidence" entre 0.0 y 1.0 indicando tu nivel de certeza.
4. Responde UNICAMENTE con un JSON array valido, sin texto adicional ni markdown.`;

/**
 * Builds the user prompt for a batch of reviews.
 * Each review is numbered with its ID for easy mapping in the response.
 */
export function buildClassificationPrompt(reviews: AppReview[]): string {
  const reviewLines = reviews
    .map((r) => `[${r.id}] "${r.text}"`)
    .join("\n");

  return `Clasifica las siguientes resenas. Responde SOLO con un JSON array valido.

Formato por cada resena:
{"reviewId": <number>, "category": "Positivo"|"Negativo"|"Spam", "spamReason": <string|null>, "confidence": <0.0-1.0>}

Resenas:
${reviewLines}`;
}

/**
 * Parses Claude's JSON response and enriches it with original review text.
 * Validates the response structure and throws on malformed output.
 */
export function parseClassificationResponse(
  response: string,
  originalReviews: AppReview[],
): ReviewClassification[] {
  let parsed: Array<{
    reviewId: number;
    category: string;
    spamReason: string | null;
    confidence: number;
  }>;

  try {
    parsed = JSON.parse(response);
  } catch (error) {
    // LLM hallucinated or returned non-JSON content — log the raw response
    // for debugging and fail fast so the batch doesn't silently corrupt results
    logger.error("LLM returned malformed JSON — aborting batch parse", {
      rawResponse: response.slice(0, 500),
      reviewIds: originalReviews.map((r) => r.id),
      parseError: error instanceof Error ? error.message : String(error),
    });
    throw new Error(
      `LLM returned malformed JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const reviewMap = new Map(originalReviews.map((r) => [r.id, r.text]));

  return parsed.map((item) => ({
    reviewId: item.reviewId,
    originalText: reviewMap.get(item.reviewId) ?? "",
    category: item.category as ReviewClassification["category"],
    spamReason: item.spamReason,
    confidence: item.confidence,
  }));
}

/**
 * Sends a batch of reviews to Claude for classification.
 * Extracts text content from the API response and parses the JSON.
 */
async function classifyBatch(
  client: Anthropic,
  reviews: AppReview[],
): Promise<ReviewClassification[]> {
  const userPrompt = buildClassificationPrompt(reviews);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  // Extract text from the response content blocks
  const textContent = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return parseClassificationResponse(textContent, reviews);
}

/**
 * Classifies all reviews in batches of BATCH_SIZE.
 * Processes batches sequentially to respect API rate limits
 * and provide clear progress logging.
 */
export async function classifyReviews(
  reviews: AppReview[],
): Promise<ClassificationBatchResult> {
  const client = new Anthropic({ apiKey: config.anthropicApiKey() });
  const allResults: ReviewClassification[] = [];
  const totalBatches = Math.ceil(reviews.length / BATCH_SIZE);

  logger.info(
    `Starting classification of ${reviews.length} reviews in ${totalBatches} batches`,
  );

  for (let i = 0; i < reviews.length; i += BATCH_SIZE) {
    const batch = reviews.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    logger.info(`Processing batch ${batchNumber}/${totalBatches}`, {
      reviewIds: batch.map((r) => r.id),
    });

    const results = await classifyBatch(client, batch);
    allResults.push(...results);
  }

  const summary = {
    positivo: allResults.filter((r) => r.category === "Positivo").length,
    negativo: allResults.filter((r) => r.category === "Negativo").length,
    spam: allResults.filter((r) => r.category === "Spam").length,
  };

  logger.info("Classification complete", { summary });

  return {
    classifiedAt: new Date().toISOString(),
    modelUsed: MODEL,
    totalReviews: reviews.length,
    results: allResults,
    summary,
  };
}
