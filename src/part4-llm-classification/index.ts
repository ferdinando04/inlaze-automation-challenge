/**
 * Part 4 — LLM Campaign Summary Entry Point
 *
 * Reads classified campaign reports from Part 1's output,
 * generates an executive summary using Anthropic Claude,
 * and saves the result to output/llm-summary.json.
 *
 * Run: npx tsx src/part4-llm-classification/index.ts
 * Requires: ANTHROPIC_API_KEY in .env
 */
import fs from "node:fs/promises";
import path from "node:path";
import { generateCampaignSummary } from "./classifier";
import { ClassifiedCampaignReport } from "../part1-api-integration/types";
import { createLogger } from "../shared/logger";

const logger = createLogger("part4-orchestrator");

async function main(): Promise<void> {
  logger.info("Starting LLM campaign summary pipeline");

  // Load classified reports from Part 1 output
  const inputPath = path.join(process.cwd(), "output", "classified-reports.json");
  const rawData = await fs.readFile(inputPath, "utf-8");
  const parsed = JSON.parse(rawData) as { reports: ClassifiedCampaignReport[] };

  logger.info(`Loaded ${parsed.reports.length} classified reports from Part 1 output`);

  // Generate executive summary via LLM
  const summary = await generateCampaignSummary(parsed.reports);

  // Save result
  const outputDir = path.join(process.cwd(), "output");
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "llm-summary.json");

  // Serialize Date to ISO string for JSON output
  const serializable = {
    ...summary,
    generatedAt: summary.generatedAt.toISOString(),
  };
  await fs.writeFile(outputPath, JSON.stringify(serializable, null, 2), "utf-8");

  logger.info("LLM summary saved", { outputPath });
}

main().catch((error: Error) => {
  logger.error("LLM summary pipeline failed", {
    errorMessage: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
