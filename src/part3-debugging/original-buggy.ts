/**
 * ORIGINAL BUGGY CODE — DO NOT MODIFY
 * This file is preserved as-is for comparison purposes.
 * See fixed.ts for the corrected version with detailed explanations.
 *
 * Known bugs:
 * 1. Division by zero when impressions = 0
 * 2. Sequential async execution instead of parallel (Promise.all)
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

// BUG 1: No guard against impressions = 0, causing division by zero → Infinity/NaN
function calculateCTR(campaign: CampaignMetrics): CampaignResult {
  return {
    id: campaign.id,
    ctr: campaign.clicks / campaign.impressions,
  };
}

// Simulates fetching campaign data from an external service
async function fetchCampaignData(id: string): Promise<CampaignMetrics> {
  return { id, clicks: Math.floor(Math.random() * 1000), impressions: Math.floor(Math.random() * 10000) };
}

// BUG 2: Using for...of with await processes campaigns sequentially,
// not in parallel. Each fetch waits for the previous one to complete.
async function processAllCampaigns(ids: string[]): Promise<CampaignResult[]> {
  const results: CampaignResult[] = [];
  for (const id of ids) {
    const data = await fetchCampaignData(id);
    results.push(calculateCTR(data));
  }
  return results;
}

export { calculateCTR, fetchCampaignData, processAllCampaigns };
