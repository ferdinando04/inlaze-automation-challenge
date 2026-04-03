/**
 * Persistence layer for classified campaign reports.
 *
 * Saves results as structured JSON with summary statistics,
 * making the output both human-readable and machine-parseable.
 * The summary section enables quick assessment without reading
 * every individual report — useful for dashboards and n8n workflows.
 */
import fs from "node:fs/promises";
import { ClassifiedCampaignReport } from "./types";
import { createLogger } from "../shared/logger";

const logger = createLogger("storage");

/** The complete output structure saved to disk */
interface StorageOutput {
  /** ISO 8601 timestamp of when the file was generated */
  generatedAt: string;
  /** Aggregate counts by classification level */
  summary: {
    total: number;
    critical: number;
    warning: number;
    ok: number;
  };
  /** The full array of classified campaign reports */
  reports: ClassifiedCampaignReport[];
}

/**
 * Calculates classification distribution from an array of classified reports.
 * Used to generate the summary section in the output file.
 */
function buildSummary(reports: ClassifiedCampaignReport[]): StorageOutput["summary"] {
  return {
    total: reports.length,
    critical: reports.filter((r) => r.classification === "Critical").length,
    warning: reports.filter((r) => r.classification === "Warning").length,
    ok: reports.filter((r) => r.classification === "OK").length,
  };
}

/**
 * Persists classified campaign reports to a JSON file.
 * Overwrites any existing file at the given path.
 * Uses 2-space indentation for human readability (reviewers will open this file).
 */
export async function saveResultsToJson(
  reports: ClassifiedCampaignReport[],
  outputPath: string,
): Promise<void> {
  const output: StorageOutput = {
    generatedAt: new Date().toISOString(),
    summary: buildSummary(reports),
    reports,
  };

  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), "utf-8");
  logger.info(`Saved ${reports.length} classified reports`, { outputPath });
}

/**
 * Loads previously saved classified reports from a JSON file.
 * Useful for re-processing or feeding data into the n8n workflow (Part 2).
 */
export async function loadResultsFromJson(filePath: string): Promise<StorageOutput> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as StorageOutput;
}
