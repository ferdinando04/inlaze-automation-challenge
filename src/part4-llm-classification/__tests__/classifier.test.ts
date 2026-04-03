import { describe, it, expect } from "vitest";
import {
  buildClassificationPrompt,
  parseClassificationResponse,
} from "../classifier";
import { AppReview } from "../types";

describe("buildClassificationPrompt", () => {
  it("formats reviews into the expected prompt structure", () => {
    const reviews: AppReview[] = [
      { id: 1, text: "Muy buena app" },
      { id: 2, text: "Malisima, no sirve" },
    ];

    const prompt = buildClassificationPrompt(reviews);

    expect(prompt).toContain("[1]");
    expect(prompt).toContain("[2]");
    expect(prompt).toContain("Muy buena app");
    expect(prompt).toContain("Malisima, no sirve");
    expect(prompt).toContain("JSON array");
  });

  it("includes all review IDs in numbered format", () => {
    const reviews: AppReview[] = [
      { id: 10, text: "Review A" },
      { id: 20, text: "Review B" },
      { id: 30, text: "Review C" },
    ];

    const prompt = buildClassificationPrompt(reviews);

    expect(prompt).toContain("[10]");
    expect(prompt).toContain("[20]");
    expect(prompt).toContain("[30]");
  });
});

describe("parseClassificationResponse", () => {
  it("parses valid JSON response from Claude", () => {
    const response = JSON.stringify([
      { reviewId: 1, category: "Positivo", spamReason: null, confidence: 0.95 },
      { reviewId: 2, category: "Negativo", spamReason: null, confidence: 0.88 },
    ]);

    const results = parseClassificationResponse(response, [
      { id: 1, text: "Muy buena app" },
      { id: 2, text: "Malisima" },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].category).toBe("Positivo");
    expect(results[1].category).toBe("Negativo");
    expect(results[0].originalText).toBe("Muy buena app");
  });

  it("handles Spam category with spamReason", () => {
    const response = JSON.stringify([
      {
        reviewId: 3,
        category: "Spam",
        spamReason: "Contiene enlace promocional externo",
        confidence: 0.99,
      },
    ]);

    const results = parseClassificationResponse(response, [
      { id: 3, text: "Gana dinero en bit.ly/xxx" },
    ]);

    expect(results[0].category).toBe("Spam");
    expect(results[0].spamReason).toBe("Contiene enlace promocional externo");
  });

  it("throws descriptive error on malformed JSON response from LLM", () => {
    expect(() =>
      parseClassificationResponse("not valid json", [{ id: 1, text: "test" }]),
    ).toThrow("LLM returned malformed JSON");
  });

  it("maps original text from reviews by ID", () => {
    const response = JSON.stringify([
      { reviewId: 5, category: "Positivo", spamReason: null, confidence: 0.9 },
    ]);

    const results = parseClassificationResponse(response, [
      { id: 5, text: "Texto original de la resena" },
    ]);

    expect(results[0].originalText).toBe("Texto original de la resena");
    expect(results[0].reviewId).toBe(5);
  });

  it("returns empty string for unmatched review IDs", () => {
    const response = JSON.stringify([
      { reviewId: 999, category: "Negativo", spamReason: null, confidence: 0.7 },
    ]);

    const results = parseClassificationResponse(response, [
      { id: 1, text: "Solo esta resena" },
    ]);

    expect(results[0].originalText).toBe("");
  });
});
