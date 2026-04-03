/**
 * Structured logger that provides context-rich log messages.
 * Replaces bare console.log calls throughout the project.
 * Each log entry includes ISO timestamp, severity level, and source context.
 *
 * Why structured JSON logs instead of plain text?
 * - Machine-parseable for log aggregation tools (Datadog, Grafana Loki)
 * - Consistent format across all modules
 * - Context field enables filtering by source (e.g., "api-client", "classifier")
 */

/** Supported log severity levels */
interface LogEntry {
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Creates a structured log entry and writes it to stdout/stderr.
 * Uses JSON format for machine-readability (important for production pipelines).
 * Errors go to stderr so they can be captured separately in production.
 */
function writeLog(entry: LogEntry): void {
  const output = JSON.stringify(entry);
  if (entry.level === "ERROR") {
    process.stderr.write(output + "\n");
  } else {
    process.stdout.write(output + "\n");
  }
}

/** Creates a logger scoped to a specific module/context */
export function createLogger(context: string) {
  return {
    info: (message: string, data?: Record<string, unknown>): void =>
      writeLog({ level: "INFO", message, context, data, timestamp: new Date().toISOString() }),

    warn: (message: string, data?: Record<string, unknown>): void =>
      writeLog({ level: "WARN", message, context, data, timestamp: new Date().toISOString() }),

    error: (message: string, data?: Record<string, unknown>): void =>
      writeLog({ level: "ERROR", message, context, data, timestamp: new Date().toISOString() }),

    debug: (message: string, data?: Record<string, unknown>): void =>
      writeLog({ level: "DEBUG", message, context, data, timestamp: new Date().toISOString() }),
  };
}
