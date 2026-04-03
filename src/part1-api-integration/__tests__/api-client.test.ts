import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchCampaignReports, fetchWithRetry } from "../api-client";
import { RetryConfig } from "../types";
import axios, { AxiosError } from "axios";

// Mock axios to avoid real HTTP calls in unit tests
vi.mock("axios", async () => {
  const actual = await vi.importActual<typeof import("axios")>("axios");
  return {
    ...actual,
    default: {
      ...actual.default,
      get: vi.fn(),
    },
  };
});

const mockedAxiosGet = vi.mocked(axios.get);

/** Fast retry config for tests — no real waiting */
const TEST_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 10,
  maxDelayMs: 50,
};

/** Simulated campaign data matching the CampaignReport interface */
const MOCK_API_RESPONSE = [
  {
    id: "camp-001",
    campaignName: "Summer Slots Promo",
    metric: 0.8,
    spend: 5000,
    revenue: 2000,
    impressions: 100000,
    clicks: 3000,
    reportDate: "2026-04-01T00:00:00Z",
  },
  {
    id: "camp-002",
    campaignName: "Live Casino Launch",
    metric: 3.2,
    spend: 3000,
    revenue: 9600,
    impressions: 80000,
    clicks: 2400,
    reportDate: "2026-04-01T00:00:00Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchWithRetry", () => {
  it("returns data on first successful attempt with 0 retries used", async () => {
    mockedAxiosGet.mockResolvedValueOnce({ data: MOCK_API_RESPONSE });

    const result = await fetchWithRetry(
      "https://api.example.com/campaigns",
      TEST_RETRY_CONFIG,
    );

    expect(result.data).toEqual(MOCK_API_RESPONSE);
    expect(result.retriesUsed).toBe(0);
    expect(mockedAxiosGet).toHaveBeenCalledTimes(1);
  });

  it("retries on network failure and succeeds on second attempt", async () => {
    mockedAxiosGet
      .mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValueOnce({ data: MOCK_API_RESPONSE });

    const result = await fetchWithRetry(
      "https://api.example.com/campaigns",
      TEST_RETRY_CONFIG,
    );

    expect(result.data).toEqual(MOCK_API_RESPONSE);
    expect(result.retriesUsed).toBe(1);
    expect(mockedAxiosGet).toHaveBeenCalledTimes(2);
  });

  it("retries on 500 server error and succeeds on third attempt", async () => {
    const serverError = new AxiosError("Internal Server Error");
    serverError.response = { status: 500, data: null, headers: {}, statusText: "ISE", config: {} as never };

    mockedAxiosGet
      .mockRejectedValueOnce(serverError)
      .mockRejectedValueOnce(serverError)
      .mockResolvedValueOnce({ data: MOCK_API_RESPONSE });

    const result = await fetchWithRetry(
      "https://api.example.com/campaigns",
      TEST_RETRY_CONFIG,
    );

    expect(result.data).toEqual(MOCK_API_RESPONSE);
    expect(result.retriesUsed).toBe(2);
    expect(mockedAxiosGet).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting all retries", async () => {
    mockedAxiosGet.mockRejectedValue(new Error("Server permanently down"));

    await expect(
      fetchWithRetry("https://api.example.com/campaigns", TEST_RETRY_CONFIG),
    ).rejects.toThrow("Server permanently down");

    // 1 initial + 3 retries = 4 total calls
    expect(mockedAxiosGet).toHaveBeenCalledTimes(4);
  });

  it("does NOT retry on 4xx client errors (they are not transient)", async () => {
    const clientError = new AxiosError("Not Found");
    clientError.response = { status: 404, data: null, headers: {}, statusText: "NF", config: {} as never };

    mockedAxiosGet.mockRejectedValue(clientError);

    await expect(
      fetchWithRetry("https://api.example.com/campaigns", TEST_RETRY_CONFIG),
    ).rejects.toThrow();

    // Should fail immediately — no retries for client errors
    expect(mockedAxiosGet).toHaveBeenCalledTimes(1);
  });

  it("retries on errors without a response (network-level failures)", async () => {
    const networkError = new AxiosError("ECONNREFUSED");
    // No response property = network-level failure
    networkError.response = undefined;

    mockedAxiosGet
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({ data: [] });

    const result = await fetchWithRetry(
      "https://api.example.com/campaigns",
      TEST_RETRY_CONFIG,
    );

    expect(result.data).toEqual([]);
    expect(result.retriesUsed).toBe(1);
  });
});

describe("fetchCampaignReports", () => {
  it("fetches and returns typed campaign reports with metadata", async () => {
    mockedAxiosGet.mockResolvedValueOnce({ data: MOCK_API_RESPONSE });

    const result = await fetchCampaignReports("https://api.example.com/campaigns");

    expect(result.reports).toHaveLength(2);
    expect(result.reports[0].campaignName).toBe("Summer Slots Promo");
    expect(result.reports[1].metric).toBe(3.2);
    expect(result.fetchedAt).toBeDefined();
    expect(result.retriesUsed).toBe(0);
  });

  it("returns empty array when API returns no data", async () => {
    mockedAxiosGet.mockResolvedValueOnce({ data: [] });

    const result = await fetchCampaignReports("https://api.example.com/campaigns");

    expect(result.reports).toHaveLength(0);
    expect(result.fetchedAt).toBeDefined();
  });
});
