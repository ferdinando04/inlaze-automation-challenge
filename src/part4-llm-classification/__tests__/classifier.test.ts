import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildSummaryPrompt, generateCampaignSummary } from "../classifier";
import { ClassifiedCampaignReport } from "../../part1-api-integration/types";

// Shared mock for the Anthropic messages.create method
const mockCreate = vi.fn();

// Mock the Anthropic SDK — must be a class constructor since code uses `new Anthropic()`
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

// Mock config to provide a fake API key
vi.mock("../../shared/config", () => ({
  config: {
    anthropicApiKey: () => "test-api-key",
  },
}));

/** Factory for test classified campaign reports */
function buildReport(overrides: Partial<ClassifiedCampaignReport> = {}): ClassifiedCampaignReport {
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
    evaluatedAt: new Date("2026-04-02T10:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildSummaryPrompt", () => {
  it("includes campaign status, name, and metric for each report", () => {
    const reports = [
      buildReport({ name: "Slots Promo", status: "critical", metric: 0.4 }),
      buildReport({ name: "Casino Launch", status: "warning", metric: 1.8 }),
    ];

    const prompt = buildSummaryPrompt(reports);

    expect(prompt).toContain("CRITICAL");
    expect(prompt).toContain("Slots Promo");
    expect(prompt).toContain("0.4");
    expect(prompt).toContain("WARNING");
    expect(prompt).toContain("Casino Launch");
    expect(prompt).toContain("1.8");
  });

  it("includes the total report count", () => {
    const reports = [buildReport(), buildReport({ id: "camp-002" })];
    const prompt = buildSummaryPrompt(reports);

    expect(prompt).toContain("2 campañas");
  });
});

describe("generateCampaignSummary", () => {
  it("returns a valid LLMSummary when the LLM responds successfully", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: "text", text: "Resumen ejecutivo: 3 campañas críticas detectadas." },
      ],
    });

    const reports = [buildReport()];
    const result = await generateCampaignSummary(reports);

    expect(result.summary).toBe("Resumen ejecutivo: 3 campañas críticas detectadas.");
    expect(result.model).toBe("claude-haiku-4-5-20251001");
    expect(result.generatedAt).toBeInstanceOf(Date);
    expect(result.rawResponse).toBeDefined();
  });

  it("throws a descriptive error when the LLM call fails", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API rate limit exceeded"));

    const reports = [buildReport()];

    await expect(generateCampaignSummary(reports)).rejects.toThrow(
      "LLM summary generation failed: API rate limit exceeded",
    );
  });

  it("throws when the LLM returns empty content", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [],
    });

    const reports = [buildReport()];

    await expect(generateCampaignSummary(reports)).rejects.toThrow(
      "LLM summary generation failed",
    );
  });
});
