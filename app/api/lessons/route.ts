import { NextResponse } from "next/server";
import { createTraceId } from "@langfuse/tracing";

import { inngest } from "@/inngest/client";
import { createLesson, listLessons } from "@/lib/lessons/repository";
import { createLessonRequestSchema } from "@/lib/lessons/schema";
import { ensureLangfuseTracing } from "@/lib/langfuse";

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

    await inngest.send({
      name: "lesson.generate",
      data: {
        lessonId: lesson.id,
        traceId,
      },
    });

    return NextResponse.json({ lesson }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create lesson.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
