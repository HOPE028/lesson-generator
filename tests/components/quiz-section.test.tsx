// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { QuizSection } from "@/components/lessons/quiz-section";
import { validLesson } from "@/tests/fixtures/lessons";

describe("QuizSection", () => {
  it("shows sheet answers by default and scores interactive answers", async () => {
    render(
      <QuizSection
        questions={validLesson.questions}
        visuals={validLesson.visuals}
      />,
    );

    expect(screen.getByText(/Answer: Tallahassee/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Interactive" }));
    await userEvent.click(screen.getByRole("button", { name: "Tallahassee" }));

    expect(screen.getByText("Correct")).toBeInTheDocument();
    expect(screen.getByText("Score: 1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Restart" }),
    ).toBeInTheDocument();
  });

  it("hides interactive mode for legacy short-answer questions", () => {
    render(
      <QuizSection
        questions={[
          {
            prompt: "What is Florida's capital?",
            answer: "Tallahassee.",
          },
        ]}
        visuals={[]}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Interactive" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Answer: Tallahassee.")).toBeInTheDocument();
  });

  it("renders generated image visuals referenced by questions", async () => {
    render(
      <QuizSection
        questions={[
          {
            id: "q1",
            prompt: "Which ecosystem is shown?",
            choices: ["Wetlands", "Desert"],
            correctAnswer: "Wetlands",
            explanation: "The image shows a wetland ecosystem.",
            visualRefs: ["wetlands-scene"],
          },
        ]}
        visuals={[
          {
            kind: "image",
            id: "wetlands-scene",
            title: "Florida wetlands",
            alt: "An illustrated classroom scene of Florida wetlands.",
            placement: "q1",
            imageUrl:
              "https://example.supabase.co/storage/v1/object/public/lesson-assets/lessons/lesson-id/wetlands-scene.webp",
            storagePath: "lessons/lesson-id/wetlands-scene.webp",
            width: 1536,
            height: 1024,
            format: "webp",
            prompt:
              "A polished educational illustration of Florida wetlands with native plants and a clear classroom-friendly composition.",
          },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Interactive" }));

    expect(
      screen.getByRole("img", {
        name: "An illustrated classroom scene of Florida wetlands.",
      }),
    ).toBeInTheDocument();
  });
});
