import type { LessonPlan } from "@/lib/lessons/schema";

export function PlanningSummary({ plan }: { plan: LessonPlan }) {
  return (
    <section className="mb-8 rounded-lg border border-black/10 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-black">Planning</h2>
      <p className="mt-2 leading-7 text-black/65">{plan.summary}</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-500">
            Planned Questions
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-black/70">
            {plan.questions.map((question) => (
              <li key={question.id}>{question.prompt}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-500">
            SVG Placements
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-black/70">
            {plan.visuals.length > 0 ? (
              plan.visuals.map((visual) => (
                <li key={visual.id}>
                  {visual.title}: {visual.placement}
                </li>
              ))
            ) : (
              <li>No planned visuals.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
