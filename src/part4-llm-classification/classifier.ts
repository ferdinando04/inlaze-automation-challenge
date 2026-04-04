/**
 * LLM-powered campaign summary generator using Anthropic Claude.
 *
 * Receives classified campaign reports from Part 1 and produces
 * an executive summary highlighting critical campaigns, warning
 * trends, and actionable recommendations.
 *
 * Uses claude-haiku-4-5-20251001 for cost-efficient generation.
 */
import Anthropic from "@anthropic-ai/sdk";
import { LLMSummary } from "./types";
import { ClassifiedCampaignReport } from "../part1-api-integration/types";
import { config } from "../shared/config";
import { createLogger } from "../shared/logger";

const logger = createLogger("llm-summary");

const MODEL = "claude-haiku-4-5-20251001";

/**
 * System prompt that instructs Claude to produce a structured
 * executive summary in Spanish, focusing on critical campaigns
 * and actionable insights for the performance marketing team.
 */
const SYSTEM_PROMPT = `Eres un analista senior de performance marketing en la industria de iGaming.

Tu tarea es generar un resumen ejecutivo en español basado en los datos de campañas publicitarias que recibirás. El resumen debe:

1. Identificar y destacar por nombre y métrica las campañas en estado "critical"
2. Resumir el estado general de las campañas en "warning"
3. Sugerir al menos una acción concreta basada en los datos recibidos

Reglas:
- Máximo 150 palabras
- Formato de resumen ejecutivo profesional
- Lenguaje directo y orientado a la acción
- Responde SOLO con el texto del resumen, sin markdown ni encabezados`;

/**
 * Builds the user prompt with campaign data formatted for the LLM.
 * Includes status, name, and metric for each campaign so the model
 * has enough context to produce a meaningful summary.
 */
export function buildSummaryPrompt(reports: ClassifiedCampaignReport[]): string {
  const lines = reports
    .map((r) => `- [${r.status.toUpperCase()}] "${r.name}" — métrica: ${r.metric}`)
    .join("\n");

  return `Genera un resumen ejecutivo de las siguientes ${reports.length} campañas:\n\n${lines}`;
}

/**
 * Generates an executive summary of campaign performance using Claude.
 *
 * @param reports - Array of classified campaign reports from Part 1
 * @returns LLMSummary with the generated text and metadata
 * @throws Error with descriptive message if the LLM call fails
 */
export async function generateCampaignSummary(
  reports: ClassifiedCampaignReport[],
): Promise<LLMSummary> {
  const client = new Anthropic({ apiKey: config.anthropicApiKey() });
  const userPrompt = buildSummaryPrompt(reports);

  logger.info("Requesting executive summary from LLM", {
    reportCount: reports.length,
    model: MODEL,
  });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    // Extract text from content blocks
    const summary = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (!summary) {
      throw new Error("LLM returned an empty response — no text content blocks found");
    }

    logger.info("Executive summary generated successfully", {
      summaryLength: summary.length,
    });

    return {
      generatedAt: new Date(),
      model: MODEL,
      summary,
      rawResponse: response,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to generate campaign summary via LLM", {
      errorMessage,
      reportCount: reports.length,
    });
    throw new Error(`LLM summary generation failed: ${errorMessage}`);
  }
}
