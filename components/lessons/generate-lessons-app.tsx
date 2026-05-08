"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { Loader2, Trash2, Wand2 } from "lucide-react";

import { AnimatedLoadingText } from "@/components/lessons/animated-loading-text";
import { CopyLinkButton } from "@/components/lessons/copy-link-button";
import { createClient } from "@/lib/supabase/client";
import type { LessonRow } from "@/lib/lessons/schema";
import { StatusBadge } from "@/components/lessons/status-badge";
import { formatRelativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";

function sortLessons(lessons: LessonRow[]) {
  return [...lessons].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function isLoadingStatus(status: LessonRow["status"]) {
  return ["planning", "generating", "validating"].includes(status);
}

export function GenerateLessonsApp() {
  const router = useRouter();
  const [outline, setOutline] = useState("");
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openingLessonId, setOpeningLessonId] = useState<string | null>(null);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const hasGeneratingLessons = useMemo(
    () =>
      lessons.some((lesson) => isLoadingStatus(lesson.status)),
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
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
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

  async function deleteLesson(
    event: MouseEvent<HTMLButtonElement>,
    lesson: LessonRow,
  ) {
    event.stopPropagation();
    setError(null);

    const title = lesson.title || "Untitled lesson";
    const confirmed = window.confirm(`Delete "${title}"? This cannot be undone.`);

    if (!confirmed) {
      return;
    }

    setDeletingLessonId(lesson.id);

    try {
      const response = await fetch(`/api/lessons/${lesson.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to delete lesson.");
      }

      setLessons((current) =>
        current.filter((currentLesson) => currentLesson.id !== lesson.id),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete lesson.",
      );
    } finally {
      setDeletingLessonId(null);
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f6f3ec] text-black">
      {openingLessonId ? (
        <div className="fixed inset-x-0 top-0 z-50 flex justify-center">
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening lesson...
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10 sm:py-14">
        <header className="space-y-3">
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
            <table className="w-full min-w-[860px] table-fixed text-left text-sm">
              <thead className="bg-black/[0.03] text-black/60">
                <tr>
                  <th className="w-[38%] px-4 py-3 font-medium">Title</th>
                  <th className="w-[18%] px-4 py-3 font-medium">Status</th>
                  <th className="w-[18%] px-4 py-3 font-medium">Created</th>
                  <th className="w-[26%] px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lessons.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-black/50" colSpan={4}>
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
                            setOpeningLessonId(lesson.id);
                            startTransition(() => {
                              router.push(`/lessons/${lesson.id}`);
                            });
                          }
                        }}
                        onKeyDown={(event) => {
                          if (
                            isClickable &&
                            (event.key === "Enter" || event.key === " ")
                          ) {
                            setOpeningLessonId(lesson.id);
                            startTransition(() => {
                              router.push(`/lessons/${lesson.id}`);
                            });
                          }
                        }}
                        role={isClickable ? "link" : undefined}
                        tabIndex={isClickable ? 0 : undefined}
                      >
                        <td className="truncate px-4 py-4 font-medium text-black">
                          {isLoadingStatus(lesson.status) &&
                          (!lesson.title || lesson.title === "Untitled lesson") ? (
                            <AnimatedLoadingText
                              text="Name being generated"
                            />
                          ) : (
                            lesson.title || "Untitled lesson"
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={lesson.status} />
                        </td>
                        <td className="px-4 py-4 text-black/55">
                          {formatRelativeTime(lesson.created_at, now)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {openingLessonId === lesson.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            ) : null}
                            <CopyLinkButton
                              className="px-2.5 py-1.5"
                              label="Copy"
                              lessonId={lesson.id}
                            />
                            <button
                              className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-sm font-medium text-red-600 transition-all duration-200 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={deletingLessonId === lesson.id}
                              onClick={(event) => deleteLesson(event, lesson)}
                              onKeyDown={(event) => event.stopPropagation()}
                              type="button"
                            >
                              {deletingLessonId === lesson.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              Delete
                            </button>
                          </div>
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
