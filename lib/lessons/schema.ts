import { z } from "zod";

export const lessonStatusSchema = z.enum([
  "planning",
  "generating",
  "validating",
  "illustrating",
  "generated",
  "failed",
]);

export type LessonStatus = z.infer<typeof lessonStatusSchema>;

export const svgElementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("circle"),
    cx: z.number(),
    cy: z.number(),
    r: z.number(),
    fill: z.string().max(40).default("none"),
    stroke: z.string().max(40).default("currentColor"),
  }),
  z.object({
    type: z.literal("rect"),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    fill: z.string().max(40).default("none"),
    stroke: z.string().max(40).default("currentColor"),
  }),
  z.object({
    type: z.literal("line"),
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
    stroke: z.string().max(40).default("currentColor"),
  }),
  z.object({
    type: z.literal("text"),
    x: z.number(),
    y: z.number(),
    text: z.string().min(1).max(80),
    fill: z.string().max(40).default("currentColor"),
  }),
]);

export const svgLessonVisualSchema = z.object({
  kind: z.literal("svg").default("svg"),
  id: z.string().min(2).max(60),
  title: z.string().min(3).max(100),
  alt: z.string().min(8).max(240),
  placement: z.string().min(2).max(80),
  viewBox: z.string().min(5).max(40).default("0 0 200 120"),
  elements: z.array(svgElementSchema).min(1).max(16),
});

export const imageLessonVisualSchema = z.object({
  kind: z.literal("image"),
  id: z.string().min(2).max(60),
  title: z.string().min(3).max(100),
  alt: z.string().min(8).max(240),
  placement: z.string().min(2).max(80),
  imageUrl: z.string().url().max(2000),
  storagePath: z.string().min(8).max(500),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: z.literal("webp"),
  prompt: z.string().min(20).max(32000),
  revisedPrompt: z.string().min(20).max(32000).optional(),
});

export const lessonVisualSchema = z.union([
  imageLessonVisualSchema,
  svgLessonVisualSchema,
]);

export type LessonVisual = z.infer<typeof lessonVisualSchema>;

export const multipleChoiceQuestionSchema = z.object({
  id: z.string().min(2).max(60),
  prompt: z.string().min(5).max(500),
  choices: z.array(z.string().min(1).max(240)).min(2).max(5),
  correctAnswer: z.string().min(1).max(240),
  explanation: z.string().min(5).max(500),
  visualRefs: z.array(z.string().min(2).max(60)).max(3).default([]),
}).refine((question) => question.choices.includes(question.correctAnswer), {
  message: "correctAnswer must exactly match one choice",
  path: ["correctAnswer"],
});

export const lessonImageRequestSchema = z.object({
  id: z.string().min(2).max(60),
  title: z.string().min(3).max(100),
  alt: z.string().min(8).max(240),
  placement: z.string().min(2).max(80),
  prompt: z.string().min(20).max(2000),
});

export type LessonImageRequest = z.infer<typeof lessonImageRequestSchema>;

const renderPrimitiveSchema = z.union([z.string(), z.number(), z.boolean()]);

export type RenderPropValue =
  | z.infer<typeof renderPrimitiveSchema>
  | RenderPropValue[]
  | { [key: string]: RenderPropValue };

export type LessonRenderNode =
  | string
  | {
      type: string;
      props: Record<string, RenderPropValue>;
      children: LessonRenderNode[];
    };

const renderPropValueSchema: z.ZodType<RenderPropValue> = z.lazy(() =>
  z.union([
    renderPrimitiveSchema,
    z.array(renderPropValueSchema),
    z.record(z.string(), renderPropValueSchema),
  ]),
);

export const lessonRenderNodeSchema: z.ZodType<LessonRenderNode> = z.lazy(() =>
  z.union([
    z.string(),
    z.object({
      type: z.string().min(1).max(80),
      props: z.record(z.string(), renderPropValueSchema).default({}),
      children: z.array(lessonRenderNodeSchema).max(200).default([]),
    }),
  ]),
);

export const lessonAssetManifestSchema = z.record(
  z.string().min(2).max(60),
  lessonVisualSchema,
);

export type LessonAssetManifest = z.infer<typeof lessonAssetManifestSchema>;

export const legacyQuestionSchema = z.object({
  prompt: z.string().min(5).max(500),
  answer: z.string().min(1).max(500),
});

export const lessonPlanSchema = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().min(20),
  questions: z.array(multipleChoiceQuestionSchema).min(1).max(12),
  visuals: z.array(lessonVisualSchema).max(8).default([]),
  imageRequests: z.array(lessonImageRequestSchema).max(2).default([]),
});

export type LessonPlan = z.infer<typeof lessonPlanSchema>;

const aiSvgElementSchema = z.object({
  type: z.enum(["circle", "rect", "line", "text"]),
  cx: z.number().nullable(),
  cy: z.number().nullable(),
  r: z.number().nullable(),
  x: z.number().nullable(),
  y: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  x1: z.number().nullable(),
  y1: z.number().nullable(),
  x2: z.number().nullable(),
  y2: z.number().nullable(),
  text: z.string().max(80).nullable(),
  fill: z.string().max(40),
  stroke: z.string().max(40),
});

const aiMultipleChoiceQuestionSchema = z.object({
  id: z.string().min(2).max(60),
  prompt: z.string().min(5).max(500),
  choices: z.array(z.string().min(1).max(240)).min(2).max(5),
  correctAnswer: z.string().min(1).max(240),
  explanation: z.string().min(5).max(500),
  visualRefs: z.array(z.string().min(2).max(60)).max(3),
});

const aiSvgLessonVisualSchema = z.object({
  kind: z.literal("svg"),
  id: z.string().min(2).max(60),
  title: z.string().min(3).max(100),
  alt: z.string().min(8).max(240),
  placement: z.string().min(2).max(80),
  viewBox: z.string().min(5).max(40),
  elements: z.array(aiSvgElementSchema).min(1).max(16),
});

export const aiLessonPlanOutputSchema = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().min(20),
  questions: z.array(aiMultipleChoiceQuestionSchema).min(1).max(12),
  visuals: z.array(aiSvgLessonVisualSchema).max(8),
  imageRequests: z.array(lessonImageRequestSchema).max(2),
});

export type AiLessonPlanOutput = z.infer<typeof aiLessonPlanOutputSchema>;

export const persistedLessonPlanSchema = lessonPlanSchema.extend({
  title: z.string().min(3).max(120).optional(),
});

export const generatedLessonSchema = z.object({
  title: z.string().min(3).max(120),
  overview: z.string().min(20).max(1200),
  objectives: z.array(z.string().min(3).max(180)).min(1).max(6),
  visuals: z.array(lessonVisualSchema).max(8).default([]),
  sections: z
    .array(
      z.object({
        heading: z.string().min(3).max(100),
        body: z.string().min(40).max(1800),
        examples: z.array(z.string().min(3).max(500)).max(5).default([]),
      }),
    )
    .min(1)
    .max(6),
  questions: z
    .array(z.union([multipleChoiceQuestionSchema, legacyQuestionSchema]))
    .max(12)
    .default([]),
});

export type GeneratedLesson = z.infer<typeof generatedLessonSchema>;

export const lessonRowSchema = z.object({
  id: z.string().uuid(),
  outline: z.string(),
  title: z.string().nullable(),
  status: lessonStatusSchema,
  typescript_source: z.string().nullable(),
  lesson_json: generatedLessonSchema.nullable(),
  tsx_source: z.string().nullable().optional(),
  render_tree_json: lessonRenderNodeSchema.nullable().optional(),
  asset_manifest_json: lessonAssetManifestSchema.nullable().optional(),
  planning_typescript_source: z.string().nullable().optional(),
  planning_json: persistedLessonPlanSchema.nullable().optional(),
  trace_id: z.string().nullable(),
  trace_url: z.string().nullable(),
  error_message: z.string().nullable(),
  attempt_count: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type LessonRow = z.infer<typeof lessonRowSchema>;

export const createLessonRequestSchema = z.object({
  outline: z.string().trim().min(8).max(2000),
});
