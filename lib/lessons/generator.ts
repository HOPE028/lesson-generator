import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { observeOpenAI } from "@langfuse/openai";
import { propagateAttributes, startActiveObservation } from "@langfuse/tracing";

import {
  aiLessonPlanOutputSchema,
  lessonPlanSchema,
  type AiLessonPlanOutput,
  type LessonAssetManifest,
  type LessonImageRequest,
  type LessonPlan,
} from "@/lib/lessons/schema";
import {
  type TsxValidationResult,
  validateGeneratedTsxSource,
} from "@/lib/lessons/tsx-validator";
import { uploadLessonImage } from "@/lib/lessons/assets";
import {
  ensureLangfuseTracing,
  flushLangfuse,
  getLangfuseTraceUrl,
} from "@/lib/langfuse";

export const PLANNING_PROMPT = `Plan a classroom lesson as structured JSON.

The LessonPlan object must include:
- title: a concise user-facing lesson title
- summary: a detailed generation brief, at least 20 characters
- questions: multiple-choice questions with id, prompt, 3-4 choices, correctAnswer, explanation, and visualRefs
- visuals: safe structured SVG specs with id, title, alt, placement, viewBox, and elements
- imageRequests: up to two rich image requests with id, title, alt, placement, and prompt

Rules:
- Return only fields that match the provided JSON schema.
- Do not include TypeScript source, imports, functions, JSX, markdown fences, comments, variables, or runtime code.
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

const PLANNING_SCHEMA_CHECKLIST = `LessonPlan validation checklist:
- title: 3-120 characters
- summary: at least 20 characters
- questions: 1-12 multiple-choice questions with id, prompt, 2-5 choices, correctAnswer, explanation, and visualRefs
- correctAnswer exactly matches one choices item
- visuals: 0-8 structured SVG visuals, each with 1-16 simple elements
- for SVG elements, fill and stroke are always required strings; unused numeric/text fields must be null
- imageRequests: 0-2 requests, each prompt 20-2000 characters
- no TypeScript source, imports, variables, functions, calls, classes, JSX, markdown fences, or comments`;

export const GENERATION_PROMPT = `Generate a polished classroom lesson as TSX from the supplied outline and validated LessonPlan.

Return only the TSX source. Do not wrap it in JSON, markdown fences, or prose.

The TSX source must:
- import approved widgets only from "@/components/lessons/generated-lesson-runtime"
- default-export one function component with no props
- return JSX directly from that function
- use semantic HTML, flexible layout, and Tailwind classes
- place approved widgets anywhere they are useful
- look like a finished lesson page, not raw generated content

Rules:
- Do not include markdown fences, comments, variables, local hooks, event handlers, raw images, raw links, style props, or dangerouslySetInnerHTML.
- Do not call functions or access browser/server APIs.
- Normal HTML elements may use className, id, role, title, and aria-label.
- Use <GeneratedVisual id="..."> to place planned SVG visuals or generated image assets from the validated plan.
- Use <GeneratedImage id="..."> only for raster imageRequests present in the validated plan; prefer <GeneratedVisual> for general lesson visuals.
- Use <Quiz questions={...} /> for interactive questions; questions must be JSON-compatible literals and correctAnswer must exactly match one choices item.
- The lesson is rendered on a very light beige page background (#f6f3ec). Default text should be black or near-black; never use white, pale gray, yellow, or low-contrast text directly on this background.
- Do not add a full-page background wrapper like min-h-screen or bg-[#f6f3ec]; the app page already provides the background. Start with a centered lesson container.
- Use a polished layout with a centered max-width container, comfortable page padding, consistent section spacing, and readable line lengths.
- Use Tailwind spacing deliberately: prefer outer wrappers like "mx-auto max-w-4xl px-5 py-10 sm:py-14", section gaps like "space-y-8" or "space-y-10", and card/section padding like "p-5 sm:p-6" or "p-6 sm:p-8".
- Use clear typography hierarchy: large black h1, smaller black section headings, and body copy with "text-black/75" or stronger.
- If a section needs a surface, use white or very light neutral backgrounds with subtle borders and shadows so black text remains readable.
- Every bordered, rounded, tinted, or card-like box must include a visible background and real internal padding. Never use a faint border alone around content.
- Avoid four-column grids for text-heavy cards; use one column on mobile and two columns on larger screens unless the content is extremely short.
- Do not hand-build mathematical notation, diagrams, fraction bars, or long-division layouts using nested div/span elements, margins, borders, and monospace text. These look fragile. Use a planned <GeneratedVisual id="..."> for diagrams when available, or explain the example in a clean padded text card.
- Avoid cramped layouts, edge-to-edge text, tiny padding, overlapping elements, awkward manual positioning, and decorative color choices that reduce legibility.
- Keep content useful but compact enough for a web page.
- Prefer expressive page structure over a rigid template.`;

const GENERATED_LESSON_SCHEMA_CHECKLIST = `Generated TSX validation checklist:
- tsxSource imports only from "@/components/lessons/generated-lesson-runtime"
- tsxSource default-exports one function component with no props
- the component body contains exactly one return statement returning JSX
- JSX uses approved HTML tags or GeneratedImage/GeneratedVisual/Quiz
- no variables, hooks, calls, local functions, event handlers, spread props, style props, raw images, raw links, browser/server APIs, markdown fences, or comments
- GeneratedImage ids match planned imageRequests
- GeneratedVisual ids match planned visuals or imageRequests
- Quiz questions are literal objects with id, prompt, choices, correctAnswer, explanation, and visualRefs`;

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

function requireNumber(value: number | null, field: string, type: string) {
  if (typeof value !== "number") {
    throw new Error(`${type} SVG element is missing numeric field "${field}".`);
  }

  return value;
}

function requireText(value: string | null, field: string, type: string) {
  if (!value) {
    throw new Error(`${type} SVG element is missing text field "${field}".`);
  }

  return value;
}

function normalizeAiLessonPlanOutput(output: AiLessonPlanOutput): LessonPlan {
  return lessonPlanSchema.parse({
    ...output,
    visuals: output.visuals.map((visual) => ({
      ...visual,
      elements: visual.elements.map((element) => {
        if (element.type === "circle") {
          return {
            type: "circle",
            cx: requireNumber(element.cx, "cx", element.type),
            cy: requireNumber(element.cy, "cy", element.type),
            r: requireNumber(element.r, "r", element.type),
            fill: element.fill,
            stroke: element.stroke,
          };
        }

        if (element.type === "rect") {
          return {
            type: "rect",
            x: requireNumber(element.x, "x", element.type),
            y: requireNumber(element.y, "y", element.type),
            width: requireNumber(element.width, "width", element.type),
            height: requireNumber(element.height, "height", element.type),
            fill: element.fill,
            stroke: element.stroke,
          };
        }

        if (element.type === "line") {
          return {
            type: "line",
            x1: requireNumber(element.x1, "x1", element.type),
            y1: requireNumber(element.y1, "y1", element.type),
            x2: requireNumber(element.x2, "x2", element.type),
            y2: requireNumber(element.y2, "y2", element.type),
            stroke: element.stroke,
          };
        }

        return {
          type: "text",
          x: requireNumber(element.x, "x", element.type),
          y: requireNumber(element.y, "y", element.type),
          text: requireText(element.text, "text", element.type),
          fill: element.fill,
        };
      }),
    })),
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

            let validationError: string | undefined;

            for (let attempt = 1; attempt <= 3; attempt += 1) {
              const openai = getOpenAI({
                lessonId: params.lessonId,
                phase: "planning",
                attempt,
              });
              const repairInstruction = validationError
                ? `\n\nThe previous LessonPlan failed validation with this error:\n${validationError}\n\nUse this checklist before returning the corrected complete response:\n${PLANNING_SCHEMA_CHECKLIST}`
                : "";
              const response = await openai.responses.parse({
                model: process.env.OPENAI_MODEL || "gpt-5.5",
                instructions: `${PLANNING_PROMPT}\n\n${PLANNING_SCHEMA_CHECKLIST}`,
                input: `Lesson outline: ${params.outline}${repairInstruction}`,
                text: {
                  format: zodTextFormat(aiLessonPlanOutputSchema, "lesson_planning"),
                },
              });

              if (!response.output_parsed) {
                throw new Error("OpenAI did not return a parseable planning response.");
              }

              try {
                const plan = normalizeAiLessonPlanOutput(response.output_parsed);

                span.update({
                  output: {
                    questionCount: plan.questions.length,
                    visualCount: plan.visuals.length,
                    attempts: attempt,
                  },
                });

                return { plan };
              } catch (error) {
                validationError = formatValidationError(error);

                await startActiveObservation("planning-repair-needed", (repairSpan) => {
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
                    `Generated LessonPlan failed validation: ${validationError}`,
                  );
                }
              }
            }

            throw new Error("Generated LessonPlan failed validation.");
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
}) {
  const imageRequests = params.plan.imageRequests.slice(0, 2);
  const assets: LessonAssetManifest = Object.fromEntries(
    params.plan.visuals.map((visual) => [visual.id, visual]),
  );

  if (imageRequests.length === 0) {
    return {
      assets,
      failures: [] as string[],
    };
  }

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

          assets[request.id] = {
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
          };
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
          generatedImages: Object.keys(assets).length,
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
    assets,
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
                ? `\n\nThe previous TSX failed validation with this error:\n${validationError}\n\nUse this checklist before returning the corrected TSX source:\n${GENERATED_LESSON_SCHEMA_CHECKLIST}`
                : "";

              const response = await openai.responses.create({
                model: process.env.OPENAI_MODEL || "gpt-5.5",
                instructions: GENERATION_PROMPT,
                input: `Lesson outline: ${params.outline}\n\nValidated plan:\n${JSON.stringify(params.plan, null, 2)}\n\n${GENERATED_LESSON_SCHEMA_CHECKLIST}${repairInstruction}`,
              });

              if (!response.output_text.trim()) {
                throw new Error("OpenAI did not return TSX source.");
              }

              const tsxSource = response.output_text;
              let validated: TsxValidationResult;

              try {
                validated = await startActiveObservation(
                  "validate-generated-tsx",
                  async (validationSpan) => {
                    validationSpan.update({
                      input: {
                        attempt,
                        title: params.plan.title,
                        sourceLength: tsxSource.length,
                      },
                    });

                    const result = validateGeneratedTsxSource(
                      tsxSource,
                      { plan: params.plan },
                    );

                    validationSpan.update({
                      output: {
                        valid: true,
                        title: params.plan.title,
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
              });

              span.update({
                output: {
                  status: "generated",
                  title: params.plan.title,
                  attempts: attempt,
                  generatedImages: Object.keys(illustrated.assets).length,
                  imageFailures: illustrated.failures.length,
                },
              });

              return {
                title: params.plan.title,
                tsxSource: validated.normalizedSource,
                renderTree: validated.renderTree,
                assetManifest: illustrated.assets,
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
