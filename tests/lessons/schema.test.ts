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

  it("accepts planning summaries longer than 1000 characters", () => {
    const plan = lessonPlanSchema.parse({
      ...validPlan,
      summary: "x".repeat(1001),
    });

    expect(plan.summary).toHaveLength(1001);
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
    expect(lesson.visuals[0]).toHaveProperty("kind", "svg");

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

  it("accepts generated image visuals and planned image requests", () => {
    const lesson = generatedLessonSchema.parse({
      ...validLesson,
      visuals: [
        {
          kind: "image",
          id: "wetlands-scene",
          title: "Florida wetlands",
          alt: "An illustrated classroom scene of Florida wetlands.",
          placement: "overview",
          imageUrl:
            "https://example.supabase.co/storage/v1/object/public/lesson-assets/lessons/lesson-id/wetlands-scene.webp",
          storagePath: "lessons/lesson-id/wetlands-scene.webp",
          width: 1536,
          height: 1024,
          format: "webp",
          prompt:
            "A polished educational illustration of Florida wetlands with native plants and a clear classroom-friendly composition.",
        },
      ],
    });
    const plan = lessonPlanSchema.parse({
      ...validPlan,
      imageRequests: [
        {
          id: "wetlands-scene",
          title: "Florida wetlands",
          alt: "An illustrated classroom scene of Florida wetlands.",
          placement: "overview",
          prompt:
            "A polished educational illustration of Florida wetlands with native plants and a clear classroom-friendly composition.",
        },
      ],
    });

    expect(lesson.visuals[0]).toHaveProperty("kind", "image");
    expect(plan.imageRequests).toHaveLength(1);
  });

  it("rejects more than two planned image requests", () => {
    expect(() =>
      lessonPlanSchema.parse({
        ...validPlan,
        imageRequests: Array.from({ length: 3 }, (_, index) => ({
          id: `image-${index}`,
          title: `Image ${index}`,
          alt: "An educational classroom illustration.",
          placement: "overview",
          prompt:
            "A polished educational illustration with a clear classroom-friendly composition.",
        })),
      }),
    ).toThrow();
  });
});
