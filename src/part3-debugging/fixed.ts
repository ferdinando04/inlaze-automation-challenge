/**
 * FIXED VERSION — Corrected campaign metrics processing.
 *
 * Two bugs were identified and fixed in the original code:
 *
 * BUG #1: Division by Zero in calculateCTR()
 * ─────────────────────────────────────────────
 * Problem: `campaign.clicks / campaign.impressions` produces Infinity when
 *          impressions = 0, and NaN when both are 0. These invalid numbers
 *          propagate silently through downstream calculations, corrupting
 *          reports without any visible error.
 * Fix:     Guard clause checks for impressions === 0 BEFORE division.
 *          Returns CTR of 0 because no impressions means no measurable rate.
 *
 * BUG #2: Sequential Execution in processAllCampaigns()
 * ──────────────────────────────────────────────────────
 * Problem: The for...of loop with `await` inside processes each campaign
 *          one at a time. With N campaigns each taking ~100ms to fetch,
 *          total time = N * 100ms (linear scaling). For 100 campaigns,
 *          that's 10 seconds of unnecessary waiting.
 * Fix:     Use `Promise.all()` to fire all fetch requests simultaneously.
 *          Total time ≈ max(individual fetch times), not sum.
 *          For 100 campaigns at ~100ms each: ~100ms vs ~10,000ms.
 */

interface CampaignMetrics {
  id: string;
  clicks: number;
  impressions: number;
}

interface CampaignResult {
  id: string;
  ctr: number;
}

/**
 * Calculates Click-Through Rate (CTR) for a campaign.
 *
 * FIX #1: Added guard clause to prevent division by zero.
 * When impressions = 0, CTR is meaningfully 0 (no impressions = no measurable rate).
 */
function calculateCTR(campaign: CampaignMetrics): CampaignResult {
  // Guard against division by zero — if no impressions were served,
  // there's no meaningful click-through rate to calculate
  if (campaign.impressions === 0) {
    return { id: campaign.id, ctr: 0 };
  }

  return {
    id: campaign.id,
    ctr: campaign.clicks / campaign.impressions,
  };
}

/** Simulates fetching campaign data from an external service */
async function fetchCampaignData(id: string): Promise<CampaignMetrics> {
  return {
    id,
    clicks: Math.floor(Math.random() * 1000),
    impressions: Math.floor(Math.random() * 10000),
  };
}

/**
 * Processes all campaigns by fetching their data and calculating CTR.
 *
 * FIX #2: Replaced sequential for...of/await loop with Promise.all().
 * Before: each fetchCampaignData() waited for the previous one to finish.
 * After:  all fetches run concurrently, reducing total time from O(n) to O(1)
 *         relative to individual fetch latency.
 *
 * Accepts an optional fetcher for dependency injection — enables tests to
 * inject a delayed mock and prove concurrency via wall-clock timing.
 */
async function processAllCampaigns(
  ids: string[],
  fetcher: (id: string) => Promise<CampaignMetrics> = fetchCampaignData,
): Promise<CampaignResult[]> {
  // Fire all fetch requests in parallel using Promise.all
  const campaignDataPromises = ids.map((id) => fetcher(id));
  const allCampaignData = await Promise.all(campaignDataPromises);

  // Map the fetched data through the CTR calculator (synchronous, no await needed)
  return allCampaignData.map(calculateCTR);
}

/**
 * Filters campaigns with CTR below the 0.02 threshold and sorts ascending.
 *
 * In iGaming performance marketing, a CTR below 2% signals that ad creative
 * or targeting is ineffective — these campaigns need immediate review.
 * Sorting worst-first lets the team prioritize the most underperforming ads.
 */
function filterLowCTRCampaigns(campaigns: CampaignResult[]): CampaignResult[] {
  return campaigns
    .filter((c) => c.ctr < 0.02)
    .sort((a, b) => a.ctr - b.ctr);
}

export { calculateCTR, fetchCampaignData, processAllCampaigns, filterLowCTRCampaigns };
