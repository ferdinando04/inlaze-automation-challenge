/**
 * HTTP client with exponential backoff retry mechanism.
 *
 * Why exponential backoff instead of fixed-interval retries?
 * When an external API fails, hammering it with immediate retries
 * makes the problem worse (thundering herd effect). Instead, we wait
 * progressively longer between attempts: ~1s, ~2s, ~4s, etc.
 *
 * Why jitter (random variance)?
 * Without jitter, if 100 clients all fail at the same time, they'd
 * all retry at exactly the same intervals — creating synchronized
 * retry storms. Jitter spreads retries randomly across time, reducing
 * the peak load on the recovering server.
 *
 * Reference: AWS Architecture Blog — "Exponential Backoff And Jitter"
 */
import axios, { AxiosError } from "axios";
import { CampaignReport, FetchResult, RetryConfig } from "./types";
import { createLogger } from "../shared/logger";

const logger = createLogger("api-client");

/** Default retry configuration: 3 retries, starting at 1s, capped at 30s */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Calculates the delay for a given retry attempt using exponential backoff with jitter.
 *
 * Formula: min(maxDelay, baseDelay * 2^attempt) * random(0.5, 1.5)
 *
 * Example progression with baseDelay=1000ms, maxDelay=30000ms:
 *   Attempt 0: ~1000ms (range: 500-1500ms)
 *   Attempt 1: ~2000ms (range: 1000-3000ms)
 *   Attempt 2: ~4000ms (range: 2000-6000ms)
 *   Attempt 3: ~8000ms (range: 4000-12000ms)
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  // Jitter: random multiplier between 0.5x and 1.5x to desynchronize retry storms
  const jitter = 0.5 + Math.random();
  return Math.floor(cappedDelay * jitter);
}

/** Promise-based delay — used between retry attempts */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determines if an HTTP error is worth retrying.
 *
 * Retryable errors (transient — may succeed on next attempt):
 *   - No response at all: network timeout, DNS failure, ECONNREFUSED
 *   - 5xx status codes: server overload, temporary outage
 *
 * Non-retryable errors (permanent — resending won't help):
 *   - 4xx status codes: bad request, unauthorized, not found
 *   - These indicate a problem with OUR request, not the server
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    if (!error.response) return true;
    return error.response.status >= 500;
  }
  // Non-Axios errors (e.g., TypeError) are assumed retryable
  // since they might be caused by transient network issues
  return true;
}

/**
 * Executes an HTTP GET with automatic retry on transient failures.
 * Returns the response data along with metadata about how many retries were needed.
 *
 * @param url - The endpoint to fetch from
 * @param retryConfig - Backoff configuration (defaults to 3 retries, 1s base, 30s cap)
 * @returns The response data and the number of retries used (0 = first attempt succeeded)
 * @throws The last error encountered after all retries are exhausted
 */
export async function fetchWithRetry<T>(
  url: string,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<{ data: T; retriesUsed: number }> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      // Wait before retrying (skip delay on first attempt)
      if (attempt > 0) {
        const backoffMs = calculateBackoffDelay(attempt - 1, retryConfig);
        logger.warn(`Retry attempt ${attempt}/${retryConfig.maxRetries}`, {
          delayMs: backoffMs,
          url,
        });
        await delay(backoffMs);
      }

      const response = await axios.get<T>(url);

      if (attempt > 0) {
        logger.info(`Request succeeded after ${attempt} retries`, { url });
      }

      return { data: response.data, retriesUsed: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      logger.error(`Request failed (attempt ${attempt + 1}/${retryConfig.maxRetries + 1})`, {
        url,
        errorMessage: lastError.message,
      });

      // Don't retry client errors (4xx) — the request itself is wrong
      if (!isRetryableError(error)) {
        throw lastError;
      }
    }
  }

  // All retries exhausted — surface the last error with context
  throw lastError ?? new Error(`All ${retryConfig.maxRetries} retries exhausted for ${url}`);
}

/**
 * High-level function to fetch campaign reports from the external API.
 * Wraps fetchWithRetry with the correct types and adds metadata to the result.
 *
 * @param apiUrl - Full URL to the campaigns endpoint
 * @param retryConfig - Optional override for retry behavior
 * @returns Array of campaign reports with fetch metadata
 */
export async function fetchCampaignReports(
  apiUrl: string,
  retryConfig?: RetryConfig,
): Promise<FetchResult> {
  const { data, retriesUsed } = await fetchWithRetry<CampaignReport[]>(apiUrl, retryConfig);

  logger.info(`Fetched ${data.length} campaign reports`, { retriesUsed });

  return {
    reports: data,
    fetchedAt: new Date().toISOString(),
    retriesUsed,
  };
}
