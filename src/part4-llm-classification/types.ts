/**
 * Types for the LLM-powered review classification system.
 * Uses Anthropic Claude to categorize app reviews in Spanish
 * into Positivo, Negativo, or Spam.
 */

/** Possible classification categories for a review */
export type ReviewCategory = "Positivo" | "Negativo" | "Spam";

/** A single app review to be classified */
export interface AppReview {
  id: number;
  text: string;
  /** Optional: original star rating from the app store */
  rating?: number;
}

/** The LLM's classification result for a single review */
export interface ReviewClassification {
  reviewId: number;
  originalText: string;
  category: ReviewCategory;
  /** Only populated when category is "Spam" — explains WHY it's spam */
  spamReason: string | null;
  /** Confidence score from 0 to 1 (extracted from LLM reasoning) */
  confidence: number;
}

/** Batch classification results with metadata */
export interface ClassificationBatchResult {
  classifiedAt: string;
  modelUsed: string;
  totalReviews: number;
  results: ReviewClassification[];
  summary: {
    positivo: number;
    negativo: number;
    spam: number;
  };
}
