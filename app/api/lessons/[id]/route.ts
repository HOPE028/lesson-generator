import { NextResponse } from "next/server";

import { getLesson } from "@/lib/lessons/repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const lesson = await getLesson(id);

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
    }

    return NextResponse.json({ lesson });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load lesson.",
      },
      { status: 500 },
    );
  }
}
