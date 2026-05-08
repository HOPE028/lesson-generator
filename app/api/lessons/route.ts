import { NextResponse } from "next/server";
import { createTraceId } from "@langfuse/tracing";

import { inngest } from "@/inngest/client";
import {
  createLesson,
  listLessons,
  markLessonFailed,
} from "@/lib/lessons/repository";
import { createLessonRequestSchema } from "@/lib/lessons/schema";
import { ensureLangfuseTracing } from "@/lib/langfuse";

export const runtime = "nodejs";

function getQueueFailureMessage(error: unknown) {
  if (
    process.env.NODE_ENV === "development" &&
    error instanceof Error &&
    error.message === "fetch failed"
  ) {
    return "Unable to queue lesson generation: Inngest dev server is not reachable. Run `bun run dev:inngest` in another terminal, then try again.";
  }

  return error instanceof Error
    ? `Unable to queue lesson generation: ${error.message}`
    : "Unable to queue lesson generation.";
}

export async function GET() {
  try {
    const lessons = await listLessons();
    return NextResponse.json({ lessons });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load lessons.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { outline } = createLessonRequestSchema.parse(body);
    ensureLangfuseTracing();
    const lesson = await createLesson(outline);
    const traceId = await createTraceId(lesson.id);

    try {
      await inngest.send({
        name: "lesson.generate",
        data: {
          lessonId: lesson.id,
          traceId,
        },
      });
    } catch (error) {
      const message = getQueueFailureMessage(error);

      await markLessonFailed(lesson.id, message);
      throw new Error(message);
    }

    return NextResponse.json({ lesson }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create lesson.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
