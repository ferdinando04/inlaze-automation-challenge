import { describe, it, expect } from "vitest";
import { classifyCampaign, classifyCampaigns, getClassificationLevel } from "../classifier";
import { CampaignReport } from "../types";

/** Factory to create test campaign reports with sensible defaults */
function buildReport(overrides: Partial<CampaignReport> = {}): CampaignReport {
  return {
    id: "test-001",
    campaignName: "Test Campaign",
    metric: 3.0,
    spend: 1000,
    revenue: 3000,
    impressions: 50000,
    clicks: 1500,
    reportDate: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

describe("getClassificationLevel", () => {
  it("returns Critical for metric < 1.0", () => {
    expect(getClassificationLevel(0.5)).toBe("Critical");
  });

  it("returns Critical for metric = 0 (edge case)", () => {
    expect(getClassificationLevel(0)).toBe("Critical");
  });

  it("returns Critical for negative metric", () => {
    expect(getClassificationLevel(-1.5)).toBe("Critical");
  });

  it("returns Warning for metric = 1.0 (boundary — lower inclusive)", () => {
    expect(getClassificationLevel(1.0)).toBe("Warning");
  });

  it("returns Warning for metric = 2.4", () => {
    expect(getClassificationLevel(2.4)).toBe("Warning");
  });

  it("returns OK for metric = 2.5 (boundary — lower inclusive)", () => {
    expect(getClassificationLevel(2.5)).toBe("OK");
  });

  it("returns OK for metric = 5.0", () => {
    expect(getClassificationLevel(5.0)).toBe("OK");
  });
});

describe("classifyCampaign", () => {
  it("classifies metric < 1.0 as Critical", () => {
    const report = buildReport({ metric: 0.5 });
    const result = classifyCampaign(report);
    expect(result.classification).toBe("Critical");
  });

  it("classifies metric = 1.0 as Warning (boundary)", () => {
    const report = buildReport({ metric: 1.0 });
    const result = classifyCampaign(report);
    expect(result.classification).toBe("Warning");
  });

  it("classifies metric = 2.5 as OK (boundary)", () => {
    const report = buildReport({ metric: 2.5 });
    const result = classifyCampaign(report);
    expect(result.classification).toBe("OK");
  });

  it("preserves all original report fields", () => {
    const report = buildReport({ id: "preserve-test", campaignName: "Preserve Me", metric: 3.0 });
    const result = classifyCampaign(report);
    expect(result.id).toBe("preserve-test");
    expect(result.campaignName).toBe("Preserve Me");
    expect(result.spend).toBe(1000);
    expect(result.revenue).toBe(3000);
  });

  it("adds classifiedAt timestamp", () => {
    const report = buildReport({ metric: 3.0 });
    const before = new Date().toISOString();
    const result = classifyCampaign(report);
    const after = new Date().toISOString();

    expect(result.classifiedAt).toBeDefined();
    expect(result.classifiedAt >= before).toBe(true);
    expect(result.classifiedAt <= after).toBe(true);
  });
});

describe("classifyCampaigns", () => {
  it("classifies an array of reports correctly", () => {
    const reports = [
      buildReport({ id: "1", metric: 0.5 }),
      buildReport({ id: "2", metric: 1.5 }),
      buildReport({ id: "3", metric: 3.0 }),
    ];
    const results = classifyCampaigns(reports);

    expect(results).toHaveLength(3);
    expect(results[0].classification).toBe("Critical");
    expect(results[1].classification).toBe("Warning");
    expect(results[2].classification).toBe("OK");
  });

  it("handles empty array gracefully", () => {
    const results = classifyCampaigns([]);
    expect(results).toEqual([]);
  });

  it("preserves input order in output", () => {
    const reports = [
      buildReport({ id: "a", metric: 4.0 }),
      buildReport({ id: "b", metric: 0.1 }),
      buildReport({ id: "c", metric: 2.0 }),
    ];
    const results = classifyCampaigns(reports);

    expect(results[0].id).toBe("a");
    expect(results[1].id).toBe("b");
    expect(results[2].id).toBe("c");
  });
});
