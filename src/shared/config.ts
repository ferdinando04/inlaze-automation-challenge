/**
 * Centralized configuration loader with validation.
 * Fails fast if required environment variables are missing,
 * preventing cryptic runtime errors downstream.
 *
 * Why lazy getters (functions) instead of eager property access?
 * Not all parts of the project need all env vars. Part 1 doesn't need
 * ANTHROPIC_API_KEY, and Part 4 doesn't need DISCORD_WEBHOOK_URL.
 * Lazy access means we only fail when a module actually needs a value.
 */
import dotenv from "dotenv";

dotenv.config();

/** Validates that a required env var exists and returns its value */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. Check .env.example for reference.`,
    );
  }
  return value;
}

/** Returns an optional env var with a fallback default */
function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  anthropicApiKey: (): string => requireEnv("ANTHROPIC_API_KEY"),
  databaseUrl: (): string => optionalEnv("DATABASE_URL", "file:./dev.db"),
  discordWebhookUrl: (): string => requireEnv("DISCORD_WEBHOOK_URL"),
  apiBaseUrl: (): string => optionalEnv("API_BASE_URL", "https://jsonplaceholder.typicode.com"),
};
