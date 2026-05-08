import { describe, expect, it } from "vitest";

import {
  generatedLessonSchema,
  lessonPlanSchema,
  lessonRowSchema,
} from "@/lib/lessons/schema";
import { buildLessonRow, validLesson, validPlan } from "@/tests/fixtures/lessons";

describe("lesson schemas", () => {
  it("requires titles for newly generated lesson plans", () => {
    expect(() =>
      lessonPlanSchema.parse({
        ...validPlan,
        title: undefined,
      }),
    ).toThrow();
  });

  it("accepts legacy persisted planning rows without titles", () => {
    const row = lessonRowSchema.parse(
      buildLessonRow({
        planning_json: {
          summary: validPlan.summary,
          questions: validPlan.questions,
          visuals: [],
        },
      }),
    );

    expect(row.planning_json?.title).toBeUndefined();
  });

  it("accepts legacy short-answer questions in generated lessons", () => {
    const lesson = generatedLessonSchema.parse({
      ...validLesson,
      questions: [
        {
          prompt: "What is Florida's capital?",
          answer: "Tallahassee.",
        },
      ],
    });

    expect(lesson.questions[0]).toHaveProperty("answer", "Tallahassee.");
  });

  it("applies visual defaults and rejects oversized visuals", () => {
    const lesson = generatedLessonSchema.parse({
      ...validLesson,
      visuals: [
        {
          id: "basic",
          title: "Basic visual",
          alt: "A simple classroom visual.",
          placement: "q1",
          elements: [
            {
              type: "circle",
              cx: 10,
              cy: 10,
              r: 5,
            },
          ],
        },
      ],
    });

    expect(lesson.visuals[0].viewBox).toBe("0 0 200 120");

    expect(() =>
      generatedLessonSchema.parse({
        ...validLesson,
        visuals: [
          {
            ...validPlan.visuals[0],
            elements: Array.from({ length: 17 }, () => validPlan.visuals[0].elements[0]),
          },
        ],
      }),
    ).toThrow();
  });
});
