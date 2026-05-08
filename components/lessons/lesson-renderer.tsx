import type { GeneratedLesson } from "@/lib/lessons/schema";
import { LessonVisual } from "@/components/lessons/lesson-visual";
import { QuizSection } from "@/components/lessons/quiz-section";

export function LessonRenderer({ lesson }: { lesson: GeneratedLesson }) {
  return (
    <article className="space-y-10">
      <header className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-500">
          Generated lesson
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-black">
          {lesson.title}
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-black/70">
          {lesson.overview}
        </p>
      </header>

      <section className="rounded-lg border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-black">Objectives</h2>
        <ul className="mt-4 grid gap-3 text-black/75 sm:grid-cols-2">
          {lesson.objectives.map((objective) => (
            <li
              className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3"
              key={objective}
            >
              {objective}
            </li>
          ))}
        </ul>
      </section>

      {lesson.visuals.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2">
          {lesson.visuals.map((visual) => (
            <LessonVisual key={visual.id} visual={visual} />
          ))}
        </section>
      ) : null}

      <div className="space-y-6">
        {lesson.sections.map((section) => (
          <section
            className="rounded-lg border border-black/10 bg-white p-6 shadow-sm transition-all duration-200 hover:border-blue-500/40 hover:shadow-md"
            key={section.heading}
          >
            <h2 className="text-2xl font-semibold text-black">
              {section.heading}
            </h2>
            <p className="mt-3 whitespace-pre-line leading-7 text-black/75">
              {section.body}
            </p>
            {section.examples.length > 0 ? (
              <div className="mt-5 space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-500">
                  Examples
                </h3>
                <ul className="space-y-2">
                  {section.examples.map((example) => (
                    <li
                      className="rounded-md bg-black/[0.03] px-3 py-2 text-black/75"
                      key={example}
                    >
                      {example}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ))}
      </div>

      {lesson.questions.length > 0 ? (
        <QuizSection questions={lesson.questions} visuals={lesson.visuals} />
      ) : null}
    </article>
  );
}
