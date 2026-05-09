import { describe, expect, it } from "vitest";

import { validateGeneratedTsxSource } from "@/lib/lessons/tsx-validator";
import { validPlan } from "@/tests/fixtures/lessons";

const validTsx = `import { GeneratedImage, GeneratedVisual, Quiz } from "@/components/lessons/generated-lesson-runtime";

export default function GeneratedLesson() {
  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <h1>Florida Pop Quiz</h1>
        <p>Use this quick review to check your knowledge of Florida.</p>
      </header>
      <Quiz questions={[{
        id: "q1",
        prompt: "What is the capital of Florida?",
        choices: ["Miami", "Tallahassee", "Orlando"],
        correctAnswer: "Tallahassee",
        explanation: "Tallahassee is Florida's capital city.",
        visualRefs: []
      }]} />
      <GeneratedVisual id="map-dot" />
      <GeneratedImage id="wetlands-scene" />
    </article>
  );
}`;

describe("validateGeneratedTsxSource", () => {
  it("accepts flexible TSX with approved widgets", () => {
    const result = validateGeneratedTsxSource(validTsx, {
      plan: {
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
      },
    });

    expect(result.renderTree).toHaveProperty("type", "article");
    expect(result.normalizedSource).toContain("export default function");
  });

  it("rejects unsafe imports and event handlers", () => {
    expect(() =>
      validateGeneratedTsxSource(
        `import fs from "node:fs";
        export default function GeneratedLesson() {
          return <article>Bad</article>;
        }`,
        { plan: validPlan },
      ),
    ).toThrow(/approved lesson runtime/);

    expect(() =>
      validateGeneratedTsxSource(
        `export default function GeneratedLesson() {
          return <button onClick={() => alert("bad")}>Bad</button>;
        }`,
        { plan: validPlan },
      ),
    ).toThrow(/Unsupported JSX element|event handlers/);
  });

  it("rejects unplanned image ids and local component logic", () => {
    expect(() =>
      validateGeneratedTsxSource(validTsx, { plan: validPlan }),
    ).toThrow(/was not requested/);

    expect(() =>
      validateGeneratedTsxSource(
        `export default function GeneratedLesson() {
          const title = "Bad";
          return <article>{title}</article>;
        }`,
        { plan: validPlan },
      ),
    ).toThrow(/exactly one return statement/);
  });
});
