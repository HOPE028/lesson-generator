import Link from "next/link";
import { notFound } from "next/navigation";

import { LessonRenderer } from "@/components/lessons/lesson-renderer";
import { StatusBadge } from "@/components/lessons/status-badge";
import { getLesson } from "@/lib/lessons/repository";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lesson = await getLesson(id);

  if (!lesson) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:py-14">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            className="inline-flex w-fit cursor-pointer items-center rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-black transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500 hover:text-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
            href="/"
          >
            Back to lessons
          </Link>
          <StatusBadge status={lesson.status} />
        </div>

        {lesson.status === "generated" && lesson.lesson_json ? (
          <>
            <LessonRenderer lesson={lesson.lesson_json} />
            {lesson.trace_url ? (
              <a
                className="mt-10 inline-flex cursor-pointer rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/25"
                href={lesson.trace_url}
                rel="noreferrer"
                target="_blank"
              >
                View generation trace
              </a>
            ) : null}
          </>
        ) : null}

        {lesson.status === "generating" ? (
          <section className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-8">
            <h1 className="text-3xl font-semibold">Lesson is generating</h1>
            <p className="mt-3 max-w-2xl leading-7 text-black/65">
              The backend is creating and validating the TypeScript lesson. Return
              to the table to see live status updates.
            </p>
          </section>
        ) : null}

        {lesson.status === "failed" ? (
          <section className="rounded-lg border border-red-200 bg-red-50 p-8">
            <h1 className="text-3xl font-semibold text-red-800">
              Lesson generation failed
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-red-700">
              {lesson.error_message || "The generator could not complete this lesson."}
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
