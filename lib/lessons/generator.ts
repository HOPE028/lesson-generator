import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { observeOpenAI } from "@langfuse/openai";
import { propagateAttributes, startActiveObservation } from "@langfuse/tracing";

import {
  aiLessonResponseSchema,
  aiPlanningResponseSchema,
  type GeneratedLesson,
  type LessonImageRequest,
  type LessonPlan,
  type LessonVisual,
} from "@/lib/lessons/schema";
import {
  normalizeGeneratedLessonSource,
  type LessonValidationResult,
  validateGeneratedLessonSource,
  validateGeneratedPlanSource,
} from "@/lib/lessons/typescript-validator";
import { uploadLessonImage } from "@/lib/lessons/assets";
import {
  ensureLangfuseTracing,
  flushLangfuse,
  getLangfuseTraceUrl,
} from "@/lib/langfuse";

export const PLANNING_PROMPT = `Plan a classroom lesson as TypeScript.

Return only an object with:
- typescriptSource: TypeScript code that default-exports one JSON-compatible object satisfying LessonPlan.

The LessonPlan object must include:
- title: a concise user-facing lesson title
- summary
- questions: multiple-choice questions with id, prompt, 3-4 choices, correctAnswer, explanation, and visualRefs
- visuals: safe structured SVG specs with id, title, alt, placement, viewBox, and elements
- imageRequests: up to two rich image requests with id, title, alt, placement, and prompt

Rules:
- Do not include imports, functions, JSX, markdown fences, comments, variables, or runtime code.
- correctAnswer must exactly match one item in choices.
- The title should be specific to the outline and ready to show in the lesson table.
- Use SVG visuals for diagrams, maps, labels, timelines, charts, geometric explanations, or anything that needs precise text.
- Use imageRequests only for rich illustrative scenes, environments, historical/science context, or engaging concept art that genuinely benefits from raster imagery.
- Most lessons should have 0-2 total imageRequests. Do not force images for abstract or simple quiz topics.
- Keep SVG elements simple: circle, rect, line, text.
- Each SVG visual must have 1-16 total elements. Never exceed 16 elements in a visual.
- Prefer 4-10 SVG elements per visual. Simplify complex drawings or move rich scenes to imageRequests instead.
- Do not create detailed SVG illustrations, icons with many strokes, repeated decorative marks, or dense maps. SVGs are for simple instructional diagrams only.
- Make placement values reference either a question id or a section concept.
- Make each image request prompt self-contained, classroom-safe, visually specific, and free of copyrighted characters or brands.`;

const GENERATION_PROMPT = `Generate classroom lesson content as TypeScript from the supplied outline and validated LessonPlan.

Return an object with:
- title: a concise lesson title
- typescriptSource: TypeScript code that default-exports one JSON-compatible object satisfying GeneratedLesson.

The TypeScript source must include:
- title, overview, objectives, visuals, sections, questions
- questions copied from the plan as multiple-choice questions with id, prompt, choices, correctAnswer, explanation, visualRefs

Rules:
- Do not include imports, functions, JSX, markdown fences, comments, variables, or runtime code.
- The TypeScript source must be exactly one default-exported object literal.
- Use JSON-compatible literal values only: strings, numbers, booleans, null, arrays, and objects.
- Use the plan as the source of truth for question and visual structure.
- Copy questions from the plan exactly, including id, choices, correctAnswer, explanation, and visualRefs.
- Copy SVG visuals from the plan exactly. Do not invent additional SVG elements, visual ids, or visual refs.
- Do not include imageRequests or image visuals in the GeneratedLesson TypeScript; raster images are generated after validation.
- Every section body must be at least 40 characters.
- The lesson must have 1-6 objectives, 1-6 sections, 0-8 visuals, and 0-12 questions.
- Keep content useful but compact enough for a web page.`;

const GENERATED_LESSON_SCHEMA_CHECKLIST = `GeneratedLesson validation checklist:
- title: 3-120 characters
- overview: 20-1200 characters
- objectives: 1-6 items, each 3-180 characters
- sections: 1-6 items with heading 3-100 characters, body 40-1800 characters, examples 0-5 items
- visuals: copy only the validated plan visuals; each SVG has 1-16 elements
- questions: copy only the validated plan questions; correctAnswer must exactly match one choices item
- visualRefs: every ref should match a copied visual id
- no imageRequests, imageUrl, storagePath, imports, variables, functions, calls, classes, markdown fences, or comments`;

const IMAGE_OUTPUT_FORMAT = "webp";
const IMAGE_SIZE = "1536x1024";
const IMAGE_WIDTH = 1536;
const IMAGE_HEIGHT = 1024;
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const FALLBACK_IMAGE_MODEL = "gpt-image-1-mini";

export function formatValidationError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== "{}"
      ? serialized
      : "Validation failed without a serializable error.";
  } catch {
    return "Validation failed with an unserializable error.";
  }
}

async function runBestEffortStep(
  label: string,
  step: (() => Promise<void>) | undefined,
) {
  if (!step) {
    return;
  }

  try {
    await step();
  } catch (error) {
    console.warn(`${label} failed:`, error);
  }
}

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

function buildImagePrompt(params: {
  outline: string;
  plan: LessonPlan;
  request: LessonImageRequest;
}) {
  return `Create one polished educational illustration for a classroom lesson.

Lesson outline: ${params.outline}
Lesson title: ${params.plan.title}
Placement: ${params.request.placement}
Image title: ${params.request.title}
Alt text intent: ${params.request.alt}

Visual brief:
${params.request.prompt}

Style requirements:
- High-quality classroom educational illustration
- Clear subject, strong composition, warm natural light
- No logos, brands, copyrighted characters, watermarks, captions, labels, or embedded text
- Suitable for students and printable lesson material`;
}

function isOrganizationVerificationError(error: unknown) {
  return (
    error instanceof Error &&
    "status" in error &&
    error.status === 403 &&
    error.message.includes("must be verified")
  );
}

async function generateImageWithFallback(params: {
  openai: OpenAI;
  prompt: string;
}) {
  const preferredModel = process.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
  const models =
    preferredModel === FALLBACK_IMAGE_MODEL
      ? [preferredModel]
      : [preferredModel, FALLBACK_IMAGE_MODEL];
  let verificationError: unknown;

  for (const model of models) {
    try {
      return {
        model,
        response: await params.openai.images.generate({
          model,
          prompt: params.prompt,
          n: 1,
          quality: "medium",
          size: IMAGE_SIZE,
          output_format: IMAGE_OUTPUT_FORMAT,
        }),
      };
    } catch (error) {
      if (!isOrganizationVerificationError(error) || model === FALLBACK_IMAGE_MODEL) {
        throw error;
      }

      verificationError = error;
      console.warn(
        `${model} is unavailable because organization verification is required. Falling back to ${FALLBACK_IMAGE_MODEL}.`,
      );
    }
  }

  throw verificationError;
}

async function generateLessonImages(params: {
  outline: string;
  lessonId: string;
  traceId: string;
  plan: LessonPlan;
  lesson: GeneratedLesson;
}) {
  const imageRequests = params.plan.imageRequests.slice(0, 2);

  if (imageRequests.length === 0) {
    return {
      lesson: params.lesson,
      failures: [] as string[],
    };
  }

  const imageVisuals: LessonVisual[] = [];
  const failures: string[] = [];

  await startActiveObservation(
    "illustration-phase",
    async (span) => {
      span.update({
        input: {
          requestedImages: imageRequests.length,
          imageIds: imageRequests.map((request) => request.id),
        },
      });

      for (const request of imageRequests) {
        try {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const { model, response } = await generateImageWithFallback({
            openai,
            prompt: buildImagePrompt({
              outline: params.outline,
              plan: params.plan,
              request,
            }),
          });
          const image = response.data?.[0];

          if (!image?.b64_json) {
            throw new Error("OpenAI did not return image data.");
          }

          const uploaded = await uploadLessonImage({
            lessonId: params.lessonId,
            imageId: request.id,
            image: Buffer.from(image.b64_json, "base64"),
          });

          imageVisuals.push({
            kind: "image",
            id: request.id,
            title: request.title,
            alt: request.alt,
            placement: request.placement,
            imageUrl: uploaded.imageUrl,
            storagePath: uploaded.storagePath,
            width: IMAGE_WIDTH,
            height: IMAGE_HEIGHT,
            format: IMAGE_OUTPUT_FORMAT,
            prompt: `${request.prompt}\n\nGenerated with ${model}.`,
            revisedPrompt: image.revised_prompt,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Image generation failed.";
          failures.push(`${request.id}: ${message}`);
          console.warn(`Skipping generated lesson image ${request.id}:`, error);
        }
      }

      span.update({
        output: {
          requestedImages: imageRequests.length,
          generatedImages: imageVisuals.length,
          failedImages: failures.length,
          imageFailures: failures,
        },
      });
    },
    {
      parentSpanContext: {
        traceId: params.traceId,
        spanId: "0000000000000001",
        traceFlags: 1,
      },
    },
  );

  return {
    lesson: {
      ...params.lesson,
      visuals: [...params.lesson.visuals, ...imageVisuals],
    },
    failures,
  };
}

export async function generateLessonFromPlan(params: {
  outline: string;
  lessonId: string;
  traceId: string;
  plan: LessonPlan;
  onValidating?: () => Promise<void>;
  onIllustrating?: () => Promise<void>;
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
                ? `\n\nThe previous TypeScript failed validation with this error:\n${validationError}\n\nUse this checklist before returning the corrected complete response:\n${GENERATED_LESSON_SCHEMA_CHECKLIST}`
                : "";

              const response = await openai.responses.parse({
                model: process.env.OPENAI_MODEL || "gpt-5.5",
                instructions: GENERATION_PROMPT,
                input: `Lesson outline: ${params.outline}\n\nValidated plan:\n${JSON.stringify(params.plan, null, 2)}\n\n${GENERATED_LESSON_SCHEMA_CHECKLIST}${repairInstruction}`,
                text: {
                  format: zodTextFormat(aiLessonResponseSchema, "lesson_generation"),
                },
              });

              if (!response.output_parsed) {
                throw new Error("OpenAI did not return a parseable lesson response.");
              }
              const parsedLessonResponse = response.output_parsed;
              let validated: LessonValidationResult;

              try {
                validated = await startActiveObservation(
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
              } catch (error) {
                validationError = formatValidationError(error);

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

                continue;
              }

              await runBestEffortStep("Mark lesson validating", params.onValidating);

              if (params.plan.imageRequests.length > 0) {
                await runBestEffortStep(
                  "Mark lesson illustrating",
                  params.onIllustrating,
                );
              }

              const illustrated = await generateLessonImages({
                outline: params.outline,
                lessonId: params.lessonId,
                traceId: params.traceId,
                plan: params.plan,
                lesson: validated.lesson,
              });

              span.update({
                output: {
                  status: "generated",
                  title: illustrated.lesson.title,
                  attempts: attempt,
                  generatedImages: illustrated.lesson.visuals.filter(
                    (visual) => visual.kind === "image",
                  ).length,
                  imageFailures: illustrated.failures.length,
                },
              });

              return {
                lesson: illustrated.lesson,
                normalizedSource: normalizeGeneratedLessonSource(
                  illustrated.lesson,
                ),
                traceUrl: getLangfuseTraceUrl(params.traceId),
              };
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
