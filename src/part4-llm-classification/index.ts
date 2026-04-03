/**
 * Part 4 — LLM Classification Entry Point
 *
 * Reads 100 sample app reviews from reviews-sample.json,
 * classifies them using Anthropic Claude, and saves the results
 * to output/classification-results.json.
 *
 * Run: npx tsx src/part4-llm-classification/index.ts
 * Requires: ANTHROPIC_API_KEY in .env
 */
import fs from "node:fs/promises";
import path from "node:path";
import { classifyReviews } from "./classifier";
import { AppReview } from "./types";
import { createLogger } from "../shared/logger";

const logger = createLogger("part4-orchestrator");

async function main(): Promise<void> {
  logger.info("Starting LLM review classification pipeline");

  // Load sample reviews
  const reviewsPath = path.join(import.meta.dirname, "reviews-sample.json");
  const rawReviews = await fs.readFile(reviewsPath, "utf-8");
  const reviews: AppReview[] = JSON.parse(rawReviews);

  logger.info(`Loaded ${reviews.length} reviews from sample file`);

  // Classify using Anthropic Claude
  const results = await classifyReviews(reviews);

  // Save results
  const outputDir = path.join(process.cwd(), "output");
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "classification-results.json");
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2), "utf-8");

  logger.info("Classification results saved", {
    outputPath,
    summary: results.summary,
  });
}

main().catch((error: Error) => {
  logger.error("Classification pipeline failed", {
    errorMessage: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
