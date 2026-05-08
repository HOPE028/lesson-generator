import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { observeOpenAI } from "@langfuse/openai";
import { propagateAttributes, startActiveObservation } from "@langfuse/tracing";

import {
  aiLessonResponseSchema,
  aiPlanningResponseSchema,
  type LessonPlan,
} from "@/lib/lessons/schema";
import {
  validateGeneratedLessonSource,
  validateGeneratedPlanSource,
} from "@/lib/lessons/typescript-validator";
import {
  ensureLangfuseTracing,
  flushLangfuse,
  getLangfuseTraceUrl,
} from "@/lib/langfuse";

const PLANNING_PROMPT = `Plan a classroom lesson as TypeScript.

Return only an object with:
- typescriptSource: TypeScript code that default-exports one JSON-compatible object satisfying LessonPlan.

The LessonPlan object must include:
- title: a concise user-facing lesson title
- summary
- questions: multiple-choice questions with id, prompt, 3-4 choices, correctAnswer, explanation, and visualRefs
- visuals: safe structured SVG specs with id, title, alt, placement, viewBox, and elements

Rules:
- Do not include imports, functions, JSX, markdown fences, comments, variables, or runtime code.
- correctAnswer must exactly match one item in choices.
- The title should be specific to the outline and ready to show in the lesson table.
- Use visuals only when they help the question sheet. Keep SVG elements simple: circle, rect, line, text.
- Make placement values reference either a question id or a section concept.`;

const GENERATION_PROMPT = `Generate classroom lesson content as TypeScript from the supplied outline and validated LessonPlan.

Return an object with:
- title: a concise lesson title
- typescriptSource: TypeScript code that default-exports one JSON-compatible object satisfying GeneratedLesson.

The TypeScript source must include:
- title, overview, objectives, visuals, sections, questions
- questions copied from the plan as multiple-choice questions with id, prompt, choices, correctAnswer, explanation, visualRefs

Rules:
- Do not include imports, functions, JSX, markdown fences, comments, variables, or runtime code.
- Use the plan as the source of truth for question and visual structure.
- Keep content useful but compact enough for a web page.`;

function getOpenAI(params: {
  lessonId: string;
  attempt?: number;
  phase: "planning" | "generation";
}) {
  ensureLangfuseTracing();

  return observeOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }), {
    traceName: "lesson-generation-workflow",
    generationName:
      params.phase === "planning" ? "plan-lesson" : "generate-typescript-lesson",
    sessionId: params.lessonId,
    tags: ["lesson-generator", params.phase],
    generationMetadata: {
      lessonId: params.lessonId,
      phase: params.phase,
      attempt: params.attempt,
    },
  });
}

export async function planLesson(params: {
  outline: string;
  lessonId: string;
  traceId: string;
}) {
  ensureLangfuseTracing();

  try {
    return await startActiveObservation(
      "planning-phase",
      async (span) =>
        propagateAttributes(
          {
            sessionId: params.lessonId,
            traceName: "lesson-generation-workflow",
            tags: ["lesson-generator", "planning"],
            metadata: { lessonId: params.lessonId, feature: "lesson_generation" },
          },
          async () => {
            span.update({ input: { outline: params.outline } });

            const openai = getOpenAI({
              lessonId: params.lessonId,
              phase: "planning",
            });
            const response = await openai.responses.parse({
              model: process.env.OPENAI_MODEL || "gpt-5.5",
              instructions: PLANNING_PROMPT,
              input: `Lesson outline: ${params.outline}`,
              text: {
                format: zodTextFormat(aiPlanningResponseSchema, "lesson_planning"),
              },
            });

            if (!response.output_parsed) {
              throw new Error("OpenAI did not return a parseable planning response.");
            }

            const validated = validateGeneratedPlanSource(
              response.output_parsed.typescriptSource,
            );

            span.update({
              output: {
                questionCount: validated.plan.questions.length,
                visualCount: validated.plan.visuals.length,
              },
            });

            return validated;
          },
        ),
      {
        parentSpanContext: {
          traceId: params.traceId,
          spanId: "0000000000000001",
          traceFlags: 1,
        },
      },
    );
  } finally {
    await flushLangfuse();
  }
}

export async function generateLessonFromPlan(params: {
  outline: string;
  lessonId: string;
  traceId: string;
  plan: LessonPlan;
  onValidating?: () => Promise<void>;
}) {
  ensureLangfuseTracing();

  try {
    return await startActiveObservation(
      "generation-and-validation-phase",
      async (span) =>
        propagateAttributes(
          {
            sessionId: params.lessonId,
            traceName: "lesson-generation-workflow",
            tags: ["lesson-generator", "generation", "validation"],
            metadata: { lessonId: params.lessonId, feature: "lesson_generation" },
          },
          async () => {
            span.update({
              input: {
                outline: params.outline,
                plannedQuestions: params.plan.questions.length,
                plannedVisuals: params.plan.visuals.length,
              },
            });

            let validationError: string | undefined;

            for (let attempt = 1; attempt <= 3; attempt += 1) {
              const openai = getOpenAI({
                lessonId: params.lessonId,
                phase: "generation",
                attempt,
              });
              const repairInstruction = validationError
                ? `\n\nThe previous TypeScript failed validation with this error. Return a corrected complete response only:\n${validationError}`
                : "";

              const response = await openai.responses.parse({
                model: process.env.OPENAI_MODEL || "gpt-5.5",
                instructions: GENERATION_PROMPT,
                input: `Lesson outline: ${params.outline}\n\nValidated plan:\n${JSON.stringify(params.plan, null, 2)}${repairInstruction}`,
                text: {
                  format: zodTextFormat(aiLessonResponseSchema, "lesson_generation"),
                },
              });

              if (!response.output_parsed) {
                throw new Error("OpenAI did not return a parseable lesson response.");
              }
              const parsedLessonResponse = response.output_parsed;
              await params.onValidating?.();

              try {
                const validated = await startActiveObservation(
                  "validate-generated-typescript",
                  async (validationSpan) => {
                    validationSpan.update({
                      input: {
                        attempt,
                        title: parsedLessonResponse.title,
                        sourceLength: parsedLessonResponse.typescriptSource.length,
                      },
                    });

                    const result = validateGeneratedLessonSource(
                      parsedLessonResponse.typescriptSource,
                    );

                    validationSpan.update({
                      output: {
                        valid: true,
                        title: result.lesson.title,
                        sectionCount: result.lesson.sections.length,
                        questionCount: result.lesson.questions.length,
                      },
                    });

                    return result;
                  },
                );

                span.update({
                  output: {
                    status: "generated",
                    title: validated.lesson.title,
                    attempts: attempt,
                  },
                });

                return {
                  ...validated,
                  traceUrl: getLangfuseTraceUrl(params.traceId),
                };
              } catch (error) {
                validationError =
                  error instanceof Error
                    ? error.message
                    : "Unknown validation error.";

                await startActiveObservation("validation-repair-needed", (repairSpan) => {
                  repairSpan.update({
                    level: attempt === 3 ? "ERROR" : "WARNING",
                    input: { attempt },
                    output: { validationError },
                  });
                });

                if (attempt === 3) {
                  span.update({
                    level: "ERROR",
                    output: { status: "failed", validationError },
                  });
                  throw new Error(
                    `Generated TypeScript failed validation: ${validationError}`,
                  );
                }
              }
            }

            throw new Error("Generated TypeScript failed validation.");
          },
        ),
      {
        parentSpanContext: {
          traceId: params.traceId,
          spanId: "0000000000000001",
          traceFlags: 1,
        },
      },
    );
  } finally {
    await flushLangfuse();
  }
}
