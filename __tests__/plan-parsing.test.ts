import { describe, it, expect } from "vitest";

// Test the JSON extraction logic that was added to plan.ts
describe("Plan JSON Parsing", () => {
  // Simulating the JSON extraction logic from plan.ts
  function extractJSON(text: string): object | null {
    // First try direct parse
    try {
      return JSON.parse(text);
    } catch {
      // Try to extract JSON from mixed content
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  it("should parse valid JSON directly", () => {
    const json = '{"sprintGoal": "Test goal", "overview": "Test overview"}';
    const result = extractJSON(json);
    expect(result).toEqual({
      sprintGoal: "Test goal",
      overview: "Test overview",
    });
  });

  it("should extract JSON from text with prefix", () => {
    const text = 'Here is the plan:\n{"sprintGoal": "Test goal", "overview": "Test overview"}';
    const result = extractJSON(text);
    expect(result).toEqual({
      sprintGoal: "Test goal",
      overview: "Test overview",
    });
  });

  it("should extract JSON from text with suffix", () => {
    const text = '{"sprintGoal": "Test goal", "overview": "Test overview"}\n\nLet me know if you need changes.';
    const result = extractJSON(text);
    expect(result).toEqual({
      sprintGoal: "Test goal",
      overview: "Test overview",
    });
  });

  it("should extract JSON from text with both prefix and suffix", () => {
    const text = 'Here is the plan:\n{"sprintGoal": "Test goal", "overview": "Test overview"}\n\nLet me know if you need changes.';
    const result = extractJSON(text);
    expect(result).toEqual({
      sprintGoal: "Test goal",
      overview: "Test overview",
    });
  });

  it("should handle nested JSON objects", () => {
    const text = 'Plan:\n{"sprintGoal": "Goal", "risks": [{"description": "Risk 1", "mitigation": "Fix it"}]}';
    const result = extractJSON(text);
    expect(result).toEqual({
      sprintGoal: "Goal",
      risks: [{ description: "Risk 1", mitigation: "Fix it" }],
    });
  });

  it("should return null for invalid JSON", () => {
    const text = "This is not JSON at all";
    const result = extractJSON(text);
    expect(result).toBeNull();
  });

  it("should return null for malformed JSON", () => {
    const text = '{"sprintGoal": "Test goal", "overview": }';
    const result = extractJSON(text);
    expect(result).toBeNull();
  });
});
