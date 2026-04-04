/**
 * Part 1 — API Integration Orchestrator
 *
 * This is the main entry point that ties together the complete pipeline:
 * 1. Fetch campaign data from an external API (with exponential backoff retry)
 * 2. Classify each campaign by its metric value (Critical/Warning/OK)
 * 3. Persist the classified results to a structured JSON file
 *
 * The output file (output/classified-reports.json) serves as input for
 * the n8n workflow in Part 2 of this technical assessment.
 *
 * Run: npx tsx src/part1-api-integration/index.ts
 */
import path from "node:path";
import fs from "node:fs/promises";
import { fetchCampaignReports } from "./api-client";
import { classifyCampaigns } from "./classifier";
import { saveResultsToJson } from "./storage";
import { CampaignReport } from "./types";
import { config } from "../shared/config";
import { createLogger } from "../shared/logger";

const logger = createLogger("part1-orchestrator");

/**
 * Sample campaign data modeled after real iGaming performance marketing scenarios.
 * In production, this data would come from the external API endpoint.
 * Covers all three classification levels to demonstrate the system's full behavior.
 *
 * These examples use iGaming-specific campaign names because Inlaze operates
 * in the iGaming/performance marketing space (Commizzion platform).
 */
const SAMPLE_CAMPAIGNS: CampaignReport[] = [
  {
    id: "camp-001",
    name: "Summer Slots Promo — LatAm",
    metric: 0.4,
    spend: 12000,
    revenue: 3200,
    impressions: 450000,
    clicks: 8500,
    reportDate: "2026-04-01T00:00:00Z",
  },
  {
    id: "camp-002",
    name: "Live Casino Launch — Colombia",
    metric: 1.8,
    spend: 8000,
    revenue: 14400,
    impressions: 320000,
    clicks: 12000,
    reportDate: "2026-04-01T00:00:00Z",
  },
  {
    id: "camp-003",
    name: "Sports Betting Q2 — Brazil",
    metric: 3.5,
    spend: 5000,
    revenue: 17500,
    impressions: 200000,
    clicks: 9500,
    reportDate: "2026-04-01T00:00:00Z",
  },
  {
    id: "camp-004",
    name: "Poker Tournament Ads — Mexico",
    metric: 0.9,
    spend: 15000,
    revenue: 7500,
    impressions: 600000,
    clicks: 4200,
    reportDate: "2026-04-01T00:00:00Z",
  },
  {
    id: "camp-005",
    name: "VIP Loyalty Program — Argentina",
    metric: 4.2,
    spend: 3000,
    revenue: 12600,
    impressions: 150000,
    clicks: 7800,
    reportDate: "2026-04-01T00:00:00Z",
  },
  {
    id: "camp-006",
    name: "Crash Games Social Ads",
    metric: 2.1,
    spend: 6500,
    revenue: 13650,
    impressions: 280000,
    clicks: 11200,
    reportDate: "2026-04-01T00:00:00Z",
  },
  {
    id: "camp-007",
    name: "Affiliate Onboarding — Peru",
    metric: 0.3,
    spend: 20000,
    revenue: 4800,
    impressions: 750000,
    clicks: 3100,
    reportDate: "2026-04-01T00:00:00Z",
  },
  {
    id: "camp-008",
    name: "Bingo Retargeting — Chile",
    metric: 2.8,
    spend: 4500,
    revenue: 12600,
    impressions: 180000,
    clicks: 6700,
    reportDate: "2026-04-01T00:00:00Z",
  },
];

/**
 * Main execution flow:
 * 1. Attempt to fetch from the configured API URL
 * 2. If the API is unreachable, fall back to sample data (for demo/review)
 * 3. Classify all reports by their metric value
 * 4. Save to output/classified-reports.json
 */
async function main(): Promise<void> {
  const outputPath = path.join(process.cwd(), "output", "classified-reports.json");
  logger.info("Starting campaign report processing pipeline");

  let reports: CampaignReport[];

  try {
    const apiUrl = config.apiBaseUrl();
    logger.info("Attempting to fetch campaign data from external API", { apiUrl });
    const fetchResult = await fetchCampaignReports(`${apiUrl}/campaigns`);
    reports = fetchResult.reports;
    logger.info(`Successfully fetched ${reports.length} reports from API`);
  } catch {
    logger.warn(
      "External API unavailable — using sample campaign data for demonstration. " +
        "This is expected behavior when running locally without a live API endpoint.",
    );
    reports = SAMPLE_CAMPAIGNS;
  }

  logger.info(`Processing ${reports.length} campaign reports through classifier`);

  const classified = classifyCampaigns(reports);

  // Ensure output directory exists before writing
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await saveResultsToJson(classified, outputPath);

  // Log a human-readable summary for quick assessment
  const summary = {
    total: classified.length,
    critical: classified.filter((r) => r.status === "critical").length,
    warning: classified.filter((r) => r.status === "warning").length,
    ok: classified.filter((r) => r.status === "ok").length,
  };

  logger.info("Pipeline completed successfully", { summary, outputPath });
}

main().catch((error: Error) => {
  logger.error("Pipeline failed with unrecoverable error", {
    errorMessage: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
