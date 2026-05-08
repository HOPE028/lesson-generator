"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Wand2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import type { LessonRow } from "@/lib/lessons/schema";
import { StatusBadge } from "@/components/lessons/status-badge";
import { cn } from "@/lib/utils";

function sortLessons(lessons: LessonRow[]) {
  return [...lessons].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function GenerateLessonsApp() {
  const router = useRouter();
  const [outline, setOutline] = useState("");
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasGeneratingLessons = useMemo(
    () => lessons.some((lesson) => lesson.status === "generating"),
    [lessons],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadLessons() {
      const response = await fetch("/api/lessons", { cache: "no-store" });
      const data = await response.json();

      if (isMounted && response.ok) {
        setLessons(sortLessons(data.lessons));
      }
    }

    loadLessons().catch(() => {
      if (isMounted) {
        setError("Unable to load lessons.");
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("lessons")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lessons" },
        (payload) => {
          const nextLesson = payload.new as LessonRow;

          if (!nextLesson?.id) {
            return;
          }

          setLessons((current) =>
            sortLessons([
              nextLesson,
              ...current.filter((lesson) => lesson.id !== nextLesson.id),
            ]),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!hasGeneratingLessons) {
      return;
    }

    const interval = window.setInterval(async () => {
      const response = await fetch("/api/lessons", { cache: "no-store" });

      if (response.ok) {
        const data = await response.json();
        setLessons(sortLessons(data.lessons));
      }
    }, 2500);

    return () => window.clearInterval(interval);
  }, [hasGeneratingLessons]);

  async function submitLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outline }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to generate lesson.");
      }

      setLessons((current) => sortLessons([data.lesson, ...current]));
      setOutline("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to generate lesson.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10 sm:py-14">
        <header className="space-y-3">
          <div className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-600">
            Lesson Generator
          </div>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Generate classroom-ready lessons from an outline.
            </h1>
            <p className="text-lg leading-8 text-black/65">
              Enter a lesson outline, generate it, and open the completed lesson
              as soon as the backend finishes.
            </p>
          </div>
        </header>

        <form className="space-y-4" onSubmit={submitLesson}>
          <label className="block text-sm font-medium text-black" htmlFor="outline">
            Lesson Outline
          </label>
          <textarea
            className="min-h-36 w-full resize-y rounded-lg border border-black/15 bg-white p-4 text-base leading-7 text-black shadow-sm outline-none transition-all duration-200 placeholder:text-black/35 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            id="outline"
            maxLength={2000}
            onChange={(event) => setOutline(event.target.value)}
            placeholder="A 10 question pop quiz on Florida"
            required
            value={outline}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-blue-500 px-5 py-2.5 font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-600 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-500/25 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || outline.trim().length < 8}
              type="submit"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Generate
            </button>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        </form>

        <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <div className="border-b border-black/10 px-4 py-3">
            <h2 className="font-semibold">Lessons</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-black/[0.03] text-black/60">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {lessons.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-black/50" colSpan={3}>
                      No lessons generated yet.
                    </td>
                  </tr>
                ) : (
                  lessons.map((lesson) => {
                    const rowClassName =
                      "border-t border-black/10 transition-all duration-200 hover:bg-blue-500/5";
                    const isClickable = lesson.status === "generated";

                    return (
                      <tr
                        className={cn(rowClassName, isClickable && "cursor-pointer")}
                        key={lesson.id}
                        onClick={() => {
                          if (isClickable) {
                            router.push(`/lessons/${lesson.id}`);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (
                            isClickable &&
                            (event.key === "Enter" || event.key === " ")
                          ) {
                            router.push(`/lessons/${lesson.id}`);
                          }
                        }}
                        role={isClickable ? "link" : undefined}
                        tabIndex={isClickable ? 0 : undefined}
                      >
                        <td className="px-4 py-4 font-medium text-black">
                          {lesson.title || "Untitled lesson"}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={lesson.status} />
                        </td>
                        <td className="px-4 py-4 text-black/55">
                          {new Date(lesson.created_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
