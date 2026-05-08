import { inngest } from "@/inngest/client";
import { generateLesson } from "@/lib/lessons/generator";
import {
  getLesson,
  incrementAttempt,
  markLessonFailed,
  markLessonGenerated,
} from "@/lib/lessons/repository";

export const generateLessonFunction = inngest.createFunction(
  {
    id: "generate-lesson",
    name: "Generate lesson",
    retries: 3,
    triggers: [{ event: "lesson.generate" }],
  },
  async ({ event, step }) => {
    const lessonId = String(event.data.lessonId);
    const traceId = String(event.data.traceId);

    const lesson = await step.run("load lesson", () => getLesson(lessonId));

    if (!lesson) {
      throw new Error(`Lesson ${lessonId} was not found.`);
    }

    await step.run("increment attempt", () => incrementAttempt(lessonId));

    try {
      const generated = await step.run("generate and validate TypeScript", () =>
        generateLesson({
          lessonId,
          outline: lesson.outline,
          traceId,
        }),
      );

      await step.run("persist generated lesson", () =>
        markLessonGenerated({
          id: lessonId,
          lesson: generated.lesson,
          typescriptSource: generated.normalizedSource,
          traceId,
          traceUrl: generated.traceUrl,
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lesson generation failed.";

      await step.run("persist failure", () => markLessonFailed(lessonId, message));
      throw error;
    }
  },
);
