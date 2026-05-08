import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { observeOpenAI } from "@langfuse/openai";
import {
  propagateAttributes,
  startActiveObservation,
} from "@langfuse/tracing";

import { aiLessonResponseSchema } from "@/lib/lessons/schema";
import { validateGeneratedLessonSource } from "@/lib/lessons/typescript-validator";
import {
  ensureLangfuseTracing,
  flushLangfuse,
  getLangfuseTraceUrl,
} from "@/lib/langfuse";

const SYSTEM_PROMPT = `You generate classroom lesson content as TypeScript.

Return an object with:
- title: a concise lesson title
- typescriptSource: TypeScript code that default-exports one JSON-compatible object satisfying GeneratedLesson.

The TypeScript source must follow this shape exactly:
export default {
  title: "...",
  overview: "...",
  objectives: ["..."],
  sections: [{ heading: "...", body: "...", examples: ["..."] }],
  questions: [{ prompt: "...", answer: "..." }]
} satisfies GeneratedLesson;

Rules:
- Do not include imports, functions, JSX, markdown fences, comments, variables, or runtime code.
- Use age-neutral, classroom-ready language.
- Include quiz questions when the outline asks for a quiz, pop quiz, or test.
- Keep content useful but compact enough for a web page.`;

async function requestLessonSource(params: {
  outline: string;
  lessonId: string;
  traceId: string;
  validationError?: string;
  attempt: number;
}) {
  ensureLangfuseTracing();

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const tracedOpenAI = observeOpenAI(openai, {
    traceName: "lesson-generation-workflow",
    generationName: "generate-typescript-lesson",
    sessionId: params.lessonId,
    tags: ["lesson-generator", "typescript-generation"],
    generationMetadata: {
      lessonId: params.lessonId,
      attempt: params.attempt,
      hasValidationError: Boolean(params.validationError),
    },
  });

  const repairInstruction = params.validationError
    ? `\n\nThe previous TypeScript failed validation with this error. Return a corrected complete response only:\n${params.validationError}`
    : "";

  const response = await tracedOpenAI.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    instructions: SYSTEM_PROMPT,
    input: `Lesson outline: ${params.outline}${repairInstruction}`,
    text: {
      format: zodTextFormat(aiLessonResponseSchema, "lesson_generation"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI did not return a parseable lesson response.");
  }

  return response.output_parsed;
}

export async function generateLesson(params: {
  outline: string;
  lessonId: string;
  traceId: string;
}) {
  ensureLangfuseTracing();

  try {
    return await startActiveObservation(
      "lesson-generation-workflow",
      async (span) =>
        propagateAttributes(
          {
            sessionId: params.lessonId,
            traceName: "lesson-generation-workflow",
            tags: ["lesson-generator", "inngest", "typescript-generation"],
            metadata: {
              lessonId: params.lessonId,
              feature: "lesson_generation",
            },
          },
          async () => {
            span.update({
              input: {
                outline: params.outline,
                lessonId: params.lessonId,
              },
            });

            let validationError: string | undefined;

            for (let attempt = 1; attempt <= 3; attempt += 1) {
              const generated = await requestLessonSource({
                ...params,
                attempt,
                validationError,
              });

              try {
                const validated = await startActiveObservation(
                  "validate-generated-typescript",
                  async (validationSpan) => {
                    validationSpan.update({
                      input: {
                        attempt,
                        title: generated.title,
                        sourceLength: generated.typescriptSource.length,
                      },
                    });

                    const result = validateGeneratedLessonSource(
                      generated.typescriptSource,
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
                    output: {
                      status: "failed",
                      validationError,
                    },
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
