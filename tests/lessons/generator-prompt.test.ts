import { describe, expect, it } from "vitest";

import {
  formatValidationError,
  PLANNING_PROMPT,
} from "@/lib/lessons/generator";

describe("lesson generation prompts", () => {
  it("states SVG element limits explicitly", () => {
    expect(PLANNING_PROMPT).toContain(
      "Each SVG visual must have 1-16 total elements.",
    );
    expect(PLANNING_PROMPT).toContain("Never exceed 16 elements");
  });

  it("preserves non-Error validation details", () => {
    expect(formatValidationError({ issues: [{ message: "Too small" }] })).toBe(
      '{"issues":[{"message":"Too small"}]}',
    );
    expect(formatValidationError("plain failure")).toBe("plain failure");
  });
});
