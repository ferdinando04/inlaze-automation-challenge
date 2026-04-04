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
  rawResponse?: unknown;
}
