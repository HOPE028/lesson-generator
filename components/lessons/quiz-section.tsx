"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import type { GeneratedLesson } from "@/lib/lessons/schema";
import { cn } from "@/lib/utils";
import { LessonVisual } from "@/components/lessons/lesson-visual";

type Question = GeneratedLesson["questions"][number];

function isMultipleChoice(question: Question) {
  return "choices" in question && "correctAnswer" in question;
}

export function QuizSection({
  questions,
  visuals,
}: {
  questions: GeneratedLesson["questions"];
  visuals: GeneratedLesson["visuals"];
}) {
  const [mode, setMode] = useState<"sheet" | "interactive">("sheet");
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const multipleChoiceQuestions = useMemo(
    () => questions.filter(isMultipleChoice),
    [questions],
  );
  const canUseInteractive = multipleChoiceQuestions.length === questions.length;
  const activeQuestion = multipleChoiceQuestions[activeIndex];
  const isCorrect =
    activeQuestion && selectedAnswer === activeQuestion.correctAnswer;

  function selectAnswer(answer: string) {
    if (selectedAnswer) {
      return;
    }

    setSelectedAnswer(answer);
    if (answer === activeQuestion.correctAnswer) {
      setScore((current) => current + 1);
    }
  }

  function nextQuestion() {
    setSelectedAnswer(null);
    setActiveIndex((current) =>
      current + 1 >= multipleChoiceQuestions.length ? 0 : current + 1,
    );
  }

  return (
    <section className="rounded-lg border border-black/10 bg-black p-6 text-white shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold">Questions</h2>
        {canUseInteractive ? (
          <div className="inline-flex w-fit rounded-md bg-white/10 p-1">
            {(["sheet", "interactive"] as const).map((nextMode) => (
              <button
                className={cn(
                  "cursor-pointer rounded px-3 py-1.5 text-sm font-medium transition-all duration-200",
                  mode === nextMode
                    ? "bg-blue-500 text-white"
                    : "text-white/70 hover:text-white",
                )}
                key={nextMode}
                onClick={() => setMode(nextMode)}
                type="button"
              >
                {nextMode === "sheet" ? "Question Sheet" : "Interactive"}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {mode === "sheet" || !canUseInteractive ? (
        <ol className="mt-5 space-y-5">
          {questions.map((question, index) => (
            <li className="space-y-3" key={question.prompt}>
              <p className="font-medium">
                {index + 1}. {question.prompt}
              </p>
              {isMultipleChoice(question) ? (
                <>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {question.choices.map((choice) => (
                      <li
                        className={cn(
                          "rounded-md border px-3 py-2 text-sm",
                          choice === question.correctAnswer
                            ? "border-blue-500 bg-blue-500/20"
                            : "border-white/10 bg-white/5",
                        )}
                        key={choice}
                      >
                        {choice}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-white/70">
                    Answer: {question.correctAnswer}. {question.explanation}
                  </p>
                </>
              ) : (
                <p className="text-sm text-white/70">
                  Answer: {question.answer}
                </p>
              )}
            </li>
          ))}
        </ol>
      ) : null}

      {mode === "interactive" && activeQuestion ? (
        <div className="mt-6 space-y-5">
          <div className="flex items-center justify-between text-sm text-white/60">
            <span>
              Question {activeIndex + 1} of {multipleChoiceQuestions.length}
            </span>
            <span>Score: {score}</span>
          </div>
          <p className="text-xl font-semibold">{activeQuestion.prompt}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeQuestion.choices.map((choice) => {
              const isSelected = selectedAnswer === choice;
              const isAnswer = choice === activeQuestion.correctAnswer;

              return (
                <button
                  className={cn(
                    "cursor-pointer rounded-md border border-white/10 bg-white/5 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500 disabled:cursor-not-allowed",
                    selectedAnswer &&
                      isAnswer &&
                      "border-blue-500 bg-blue-500/25",
                    selectedAnswer &&
                      isSelected &&
                      !isAnswer &&
                      "border-red-400 bg-red-500/20",
                  )}
                  disabled={Boolean(selectedAnswer)}
                  key={choice}
                  onClick={() => selectAnswer(choice)}
                  type="button"
                >
                  {choice}
                </button>
              );
            })}
          </div>

          {selectedAnswer ? (
            <div className="rounded-lg bg-white/10 p-4">
              <div className="flex items-center gap-2 font-medium">
                {isCorrect ? (
                  <CheckCircle2 className="h-5 w-5 text-blue-300" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-300" />
                )}
                {isCorrect ? "Correct" : "Not quite"}
              </div>
              <p className="mt-2 text-sm text-white/75">
                {activeQuestion.explanation}
              </p>
              <button
                className="mt-4 cursor-pointer rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-blue-600"
                onClick={nextQuestion}
                type="button"
              >
                {activeIndex + 1 >= multipleChoiceQuestions.length
                  ? "Restart"
                  : "Next question"}
              </button>
            </div>
          ) : null}

          {activeQuestion.visualRefs.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {visuals
                .filter((visual) => activeQuestion.visualRefs.includes(visual.id))
                .map((visual) => (
                  <LessonVisual key={visual.id} visual={visual} />
                ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
