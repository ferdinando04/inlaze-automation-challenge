import { describe, it, expect, vi } from "vitest";
import { calculateCTR, processAllCampaigns, filterLowCTRCampaigns } from "../fixed";

describe("calculateCTR (Bug Fix #1: Division by Zero)", () => {
  it("calculates CTR correctly with valid impressions", () => {
    const result = calculateCTR({ id: "test-1", clicks: 150, impressions: 10000 });
    expect(result.ctr).toBeCloseTo(0.015);
  });

  it("returns 0 CTR when impressions is 0 (previously caused division by zero)", () => {
    const result = calculateCTR({ id: "test-2", clicks: 100, impressions: 0 });
    expect(result.ctr).toBe(0);
    expect(Number.isFinite(result.ctr)).toBe(true);
  });

  it("returns 0 CTR when both clicks and impressions are 0", () => {
    const result = calculateCTR({ id: "test-3", clicks: 0, impressions: 0 });
    expect(result.ctr).toBe(0);
  });

  it("handles zero clicks with valid impressions", () => {
    const result = calculateCTR({ id: "test-4", clicks: 0, impressions: 5000 });
    expect(result.ctr).toBe(0);
  });
});

describe("processAllCampaigns (Bug Fix #2: Sequential → Parallel)", () => {
  it("processes all campaigns and returns results", async () => {
    const results = await processAllCampaigns(["a", "b", "c"]);
    expect(results).toHaveLength(3);
    results.forEach((result) => {
      expect(result.id).toBeDefined();
      expect(typeof result.ctr).toBe("number");
      expect(Number.isFinite(result.ctr)).toBe(true);
    });
  });

  it("executes fetches in parallel, not sequentially (mocked delay proof)", async () => {
    /**
     * Proof-by-timing with dependency injection:
     * Each mock fetch takes 100ms via setTimeout.
     * - If parallel (Promise.all): total ≈ 100ms (all 3 resolve concurrently)
     * - If sequential (for-await): total ≈ 300ms (each waits for previous)
     * Threshold at 200ms definitively catches sequential regressions.
     */
    const DELAY_MS = 100;
    const mockFetcher = vi.fn((id: string) =>
      new Promise<{ id: string; clicks: number; impressions: number }>((resolve) =>
        setTimeout(() => resolve({ id, clicks: 50, impressions: 1000 }), DELAY_MS),
      ),
    );

    const ids = ["x", "y", "z"];
    const start = Date.now();
    const results = await processAllCampaigns(ids, mockFetcher);
    const elapsed = Date.now() - start;

    // Parallel: ~100ms. Sequential would be ~300ms. 200ms threshold is safe.
    expect(elapsed).toBeLessThan(200);
    expect(results).toHaveLength(3);
    expect(mockFetcher).toHaveBeenCalledTimes(3);
    // Verify each campaign got the correct CTR from mocked data
    results.forEach((r) => expect(r.ctr).toBeCloseTo(0.05));
  });

  it("handles empty campaign list", async () => {
    const results = await processAllCampaigns([]);
    expect(results).toEqual([]);
  });
});

describe("filterLowCTRCampaigns (Req 12: filtro CTR < 0.02)", () => {
  it("retorna solo campañas con ctr < 0.02", () => {
    const campaigns = [
      { id: "a", ctr: 0.005 },
      { id: "b", ctr: 0.05 },
      { id: "c", ctr: 0.015 },
      { id: "d", ctr: 0.02 },
    ];
    const result = filterLowCTRCampaigns(campaigns);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("ordena resultados de menor a mayor CTR", () => {
    const campaigns = [
      { id: "x", ctr: 0.015 },
      { id: "y", ctr: 0.003 },
      { id: "z", ctr: 0.01 },
    ];
    const result = filterLowCTRCampaigns(campaigns);

    expect(result[0].id).toBe("y");
    expect(result[1].id).toBe("z");
    expect(result[2].id).toBe("x");
  });

  it("retorna array vacío si ninguna campaña cumple el umbral", () => {
    const campaigns = [
      { id: "a", ctr: 0.05 },
      { id: "b", ctr: 0.02 },
    ];
    const result = filterLowCTRCampaigns(campaigns);

    expect(result).toEqual([]);
  });

  it("retorna array vacío si el input está vacío", () => {
    const result = filterLowCTRCampaigns([]);
    expect(result).toEqual([]);
  });
});
