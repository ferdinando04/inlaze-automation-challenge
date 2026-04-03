/**
 * Core domain types for the campaign reporting system.
 * These interfaces model the data flowing from the external API
 * through classification and into persistent storage.
 *
 * Data flow: External API → CampaignReport → ClassifiedCampaignReport → JSON file
 */

/** Raw campaign data as received from the external API */
export interface CampaignReport {
  id: string;
  campaignName: string;
  /** The key performance metric used for classification (e.g., ROAS, CTR) */
  metric: number;
  /** Total ad spend in USD */
  spend: number;
  /** Revenue generated from the campaign */
  revenue: number;
  /** Number of ad impressions served */
  impressions: number;
  /** Number of user clicks on the ad */
  clicks: number;
  /** ISO 8601 date string of when the report was generated */
  reportDate: string;
}

/**
 * Classification severity based on the metric value:
 * - Critical: metric < 1.0 (immediate attention required — campaign is losing money)
 * - Warning: metric < 2.5 (needs monitoring — campaign underperforming)
 * - OK: metric >= 2.5 (performing well — no action needed)
 */
export type ClassificationLevel = "Critical" | "Warning" | "OK";

/** Campaign report enriched with its classification level */
export interface ClassifiedCampaignReport extends CampaignReport {
  classification: ClassificationLevel;
  /** ISO 8601 timestamp of when the classification was performed */
  classifiedAt: string;
}

/** Configuration for the exponential backoff retry mechanism */
export interface RetryConfig {
  /** Maximum number of retry attempts before giving up */
  maxRetries: number;
  /** Initial delay in milliseconds before the first retry */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds to prevent excessive waits */
  maxDelayMs: number;
}

/** Result of an API fetch operation, including metadata */
export interface FetchResult {
  reports: CampaignReport[];
  /** ISO 8601 timestamp of when the fetch completed */
  fetchedAt: string;
  /** Number of retries that were needed (0 = first attempt succeeded) */
  retriesUsed: number;
}
