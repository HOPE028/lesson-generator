import { z } from "zod";

export const lessonStatusSchema = z.enum([
  "generating",
  "generated",
  "failed",
]);

export type LessonStatus = z.infer<typeof lessonStatusSchema>;

export const generatedLessonSchema = z.object({
  title: z.string().min(3).max(120),
  overview: z.string().min(20).max(1200),
  objectives: z.array(z.string().min(3).max(180)).min(1).max(6),
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
    .array(
      z.object({
        prompt: z.string().min(5).max(500),
        answer: z.string().min(1).max(500),
      }),
    )
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

export const aiLessonResponseSchema = z.object({
  title: z.string().min(3).max(120),
  typescriptSource: z.string().min(80).max(20000),
});
