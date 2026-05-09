import { describe, expect, it } from "vitest";

import {
  formatValidationError,
  GENERATION_PROMPT,
  PLANNING_PROMPT,
} from "@/lib/lessons/generator";

describe("lesson generation prompts", () => {
  it("states SVG element limits explicitly", () => {
    expect(PLANNING_PROMPT).toContain("structured JSON");
    expect(PLANNING_PROMPT).not.toContain("typescriptSource");
    expect(PLANNING_PROMPT).toContain(
      "Each SVG visual must have 1-16 total elements.",
    );
    expect(PLANNING_PROMPT).toContain("Never exceed 16 elements");
  });

  it("reminds TSX generation about page background contrast", () => {
    expect(GENERATION_PROMPT).toContain("beige page background");
    expect(GENERATION_PROMPT).toContain("Default text should be black");
    expect(GENERATION_PROMPT).toContain("centered max-width container");
    expect(GENERATION_PROMPT).toContain("comfortable page padding");
    expect(GENERATION_PROMPT).toContain("p-6 sm:p-8");
    expect(GENERATION_PROMPT).toContain("Every bordered, rounded, tinted, or card-like box");
    expect(GENERATION_PROMPT).toContain("Do not hand-build mathematical notation");
    expect(GENERATION_PROMPT).toContain("<GeneratedVisual");
  });

  it("preserves non-Error validation details", () => {
    expect(formatValidationError({ issues: [{ message: "Too small" }] })).toBe(
      '{"issues":[{"message":"Too small"}]}',
    );
    expect(formatValidationError("plain failure")).toBe("plain failure");
  });
});
