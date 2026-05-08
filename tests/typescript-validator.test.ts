import { describe, expect, it } from "vitest";

import { validateGeneratedLessonSource } from "@/lib/lessons/typescript-validator";

const validSource = `export default {
  title: "Florida Pop Quiz",
  overview: "A short classroom pop quiz that checks student knowledge about Florida geography, history, and symbols.",
  objectives: ["Identify key Florida facts", "Answer concise quiz questions"],
  sections: [
    {
      heading: "Quiz Instructions",
      body: "Read each question carefully and answer in a complete sentence when possible. Use what you know about Florida's places, climate, and state symbols.",
      examples: ["Florida is a state in the southeastern United States."]
    }
  ],
  questions: [
    { prompt: "What is the capital of Florida?", answer: "Tallahassee" }
  ]
} satisfies GeneratedLesson;`;

describe("validateGeneratedLessonSource", () => {
  it("accepts JSON-compatible TypeScript lesson modules", () => {
    const result = validateGeneratedLessonSource(validSource);

    expect(result.lesson.title).toBe("Florida Pop Quiz");
    expect(result.normalizedSource).toContain("satisfies GeneratedLesson");
  });

  it("rejects runtime code", () => {
    expect(() =>
      validateGeneratedLessonSource(`export default (() => ({
        title: "Unsafe",
        overview: "This should never be executed by the application.",
        objectives: ["Reject runtime code"],
        sections: [],
        questions: []
      }))();`),
    ).toThrow(/Unsafe TypeScript node rejected|JSON-compatible/);
  });

  it("rejects schema-invalid lessons", () => {
    expect(() =>
      validateGeneratedLessonSource(`export default {
        title: "Bad",
        overview: "Too short",
        objectives: [],
        sections: [],
        questions: []
      } satisfies GeneratedLesson;`),
    ).toThrow();
  });
});
