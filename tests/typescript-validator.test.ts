import { describe, expect, it } from "vitest";

import {
  validateGeneratedLessonSource,
  validateGeneratedPlanSource,
} from "@/lib/lessons/typescript-validator";

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
    {
      id: "q1",
      prompt: "What is the capital of Florida?",
      choices: ["Miami", "Tallahassee", "Orlando"],
      correctAnswer: "Tallahassee",
      explanation: "Tallahassee is Florida's capital city.",
      visualRefs: []
    }
  ]
} satisfies GeneratedLesson;`;

const validPlanSource = `export default {
  title: "Florida Pop Quiz",
  summary: "Plan a short quiz with one question and one visual placement for classroom review.",
  questions: [
    {
      id: "q1",
      prompt: "What is the capital of Florida?",
      choices: ["Miami", "Tallahassee", "Orlando"],
      correctAnswer: "Tallahassee",
      explanation: "Tallahassee is Florida's capital city.",
      visualRefs: ["map-dot"]
    }
  ],
  visuals: [
    {
      id: "map-dot",
      title: "Florida capital marker",
      alt: "A simple diagram marking the capital of Florida.",
      placement: "q1",
      viewBox: "0 0 200 120",
      elements: [
        { type: "circle", cx: 100, cy: 60, r: 20, fill: "none", stroke: "currentColor" },
        { type: "text", x: 100, y: 60, text: "Capital", fill: "currentColor" }
      ]
    }
  ]
} satisfies LessonPlan;`;

describe("validateGeneratedLessonSource", () => {
  it("accepts JSON-compatible TypeScript lesson modules", () => {
    const result = validateGeneratedLessonSource(validSource);

    expect(result.lesson.title).toBe("Florida Pop Quiz");
    expect(result.normalizedSource).toContain("satisfies GeneratedLesson");
  });

  it("accepts JSON-compatible TypeScript lesson plans", () => {
    const result = validateGeneratedPlanSource(validPlanSource);

    expect(result.plan.questions[0].correctAnswer).toBe("Tallahassee");
    expect(result.normalizedSource).toContain("satisfies LessonPlan");
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

  it("rejects multiple-choice answers that are not choices", () => {
    expect(() =>
      validateGeneratedLessonSource(`export default {
        title: "Bad Quiz",
        overview: "A classroom quiz with a broken answer option that should fail validation.",
        objectives: ["Catch invalid answer keys"],
        sections: [{ heading: "Quiz", body: "This section has enough detail to pass the body length requirement.", examples: [] }],
        questions: [{
          id: "q1",
          prompt: "Pick the answer.",
          choices: ["A", "B"],
          correctAnswer: "C",
          explanation: "C is not present.",
          visualRefs: []
        }]
      } satisfies GeneratedLesson;`),
    ).toThrow(/correctAnswer/);
  });
});
