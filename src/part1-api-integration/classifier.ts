/**
 * Campaign classification engine.
 * Assigns severity levels to campaigns based on their performance metric.
 *
 * Classification thresholds (defined by Inlaze's requirements):
 * - Critical: metric < 1.0  → Campaign is underperforming severely, losing money
 * - Warning:  metric < 2.5  → Campaign needs attention, below acceptable ROAS
 * - OK:       metric >= 2.5 → Campaign is performing well, no action needed
 *
 * In iGaming performance marketing, these thresholds correspond to ROAS
 * (Return on Ad Spend). A ROAS < 1.0 means the campaign is spending more
 * than it earns — a critical situation requiring immediate intervention.
 */
import {
  CampaignReport,
  ClassificationLevel,
  ClassifiedCampaignReport,
} from "./types";

/**
 * Determines the classification level for a given metric value.
 * Uses strict threshold boundaries as specified in the requirements:
 *   metric < 1.0  → critical
 *   metric < 2.5  → warning
 *   metric >= 2.5 → ok
 */
export function getClassificationLevel(metric: number): ClassificationLevel {
  if (metric < 1.0) return "critical";
  if (metric < 2.5) return "warning";
  return "ok";
}

/**
 * Enriches a single campaign report with its classification.
 * Pure function — no side effects, deterministic output for the same input.
 */
export function classifyCampaign(report: CampaignReport): ClassifiedCampaignReport {
  return {
    ...report,
    status: getClassificationLevel(report.metric),
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Classifies an array of campaign reports in bulk.
 * Preserves input order in the output array — important for maintaining
 * correlation between request and response in downstream systems.
 */
export function classifyCampaigns(reports: CampaignReport[]): ClassifiedCampaignReport[] {
  return reports.map(classifyCampaign);
}
