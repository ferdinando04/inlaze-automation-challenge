import { describe, it, expect, afterEach } from "vitest";
import { saveResultsToJson, loadResultsFromJson } from "../storage";
import { ClassifiedCampaignReport } from "../types";
import fs from "node:fs";
import path from "node:path";

const TEST_OUTPUT_PATH = path.join(process.cwd(), "test-output-results.json");

/** Factory for test classified reports */
function buildClassifiedReport(
  overrides: Partial<ClassifiedCampaignReport> = {},
): ClassifiedCampaignReport {
  return {
    id: "camp-001",
    name: "Test Campaign",
    metric: 0.5,
    spend: 5000,
    revenue: 2000,
    impressions: 100000,
    clicks: 3000,
    reportDate: "2026-04-01T00:00:00Z",
    status: "critical",
    evaluatedAt: "2026-04-02T10:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  // Clean up test files after each test
  if (fs.existsSync(TEST_OUTPUT_PATH)) {
    fs.unlinkSync(TEST_OUTPUT_PATH);
  }
});

describe("saveResultsToJson", () => {
  it("writes classified reports to a JSON file", async () => {
    const reports = [buildClassifiedReport()];

    await saveResultsToJson(reports, TEST_OUTPUT_PATH);

    expect(fs.existsSync(TEST_OUTPUT_PATH)).toBe(true);
    const content = JSON.parse(fs.readFileSync(TEST_OUTPUT_PATH, "utf-8"));
    expect(content.reports).toHaveLength(1);
    expect(content.reports[0].status).toBe("critical");
    expect(content.generatedAt).toBeDefined();
    expect(content.summary).toBeDefined();
  });

  it("includes correct classification summary counts", async () => {
    const reports = [
      buildClassifiedReport({ id: "1", status: "critical" }),
      buildClassifiedReport({ id: "2", status: "warning" }),
      buildClassifiedReport({ id: "3", status: "ok" }),
      buildClassifiedReport({ id: "4", status: "ok" }),
    ];

    await saveResultsToJson(reports, TEST_OUTPUT_PATH);

    const content = JSON.parse(fs.readFileSync(TEST_OUTPUT_PATH, "utf-8"));
    expect(content.summary.total).toBe(4);
    expect(content.summary.critical).toBe(1);
    expect(content.summary.warning).toBe(1);
    expect(content.summary.ok).toBe(2);
  });

  it("writes pretty-printed JSON (human-readable for reviewers)", async () => {
    const reports = [buildClassifiedReport()];

    await saveResultsToJson(reports, TEST_OUTPUT_PATH);

    const raw = fs.readFileSync(TEST_OUTPUT_PATH, "utf-8");
    // Pretty-printed JSON contains newlines and indentation
    expect(raw).toContain("\n");
    expect(raw).toContain("  ");
  });

  it("handles empty report array", async () => {
    await saveResultsToJson([], TEST_OUTPUT_PATH);

    const content = JSON.parse(fs.readFileSync(TEST_OUTPUT_PATH, "utf-8"));
    expect(content.reports).toEqual([]);
    expect(content.summary.total).toBe(0);
  });
});

describe("loadResultsFromJson", () => {
  it("reads previously saved results with full fidelity", async () => {
    const reports = [
      buildClassifiedReport({ id: "load-test", name: "Fidelity Test" }),
    ];
    await saveResultsToJson(reports, TEST_OUTPUT_PATH);

    const loaded = await loadResultsFromJson(TEST_OUTPUT_PATH);

    expect(loaded.reports).toHaveLength(1);
    expect(loaded.reports[0].id).toBe("load-test");
    expect(loaded.reports[0].name).toBe("Fidelity Test");
    expect(loaded.generatedAt).toBeDefined();
  });

  it("throws a descriptive error if file does not exist", async () => {
    await expect(
      loadResultsFromJson("/nonexistent/path/results.json"),
    ).rejects.toThrow();
  });
});
