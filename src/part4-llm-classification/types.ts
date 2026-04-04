/**
 * Types for the LLM-powered campaign summary system.
 * Uses Anthropic Claude to generate executive summaries
 * from classified campaign report data.
 */

/** Result of an LLM-generated executive summary */
export interface LLMSummary {
  generatedAt: Date;
  model: string;
  summary: string;
  /** Names of campaigns identified as critical by the LLM */
  criticalCampaigns: string[];
  /** Concrete actions suggested by the LLM based on the data */
  suggestedActions: string[];
  rawResponse?: unknown;
}
