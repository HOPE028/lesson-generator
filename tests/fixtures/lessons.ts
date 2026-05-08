import type { GeneratedLesson, LessonPlan, LessonRow } from "@/lib/lessons/schema";

export const validPlan: LessonPlan = {
  title: "Florida Pop Quiz",
  summary: "A short quiz plan with one question and one visual placement.",
  questions: [
    {
      id: "q1",
      prompt: "What is the capital of Florida?",
      choices: ["Miami", "Tallahassee", "Orlando"],
      correctAnswer: "Tallahassee",
      explanation: "Tallahassee is Florida's capital city.",
      visualRefs: ["map-dot"],
    },
  ],
  visuals: [
    {
      kind: "svg",
      id: "map-dot",
      title: "Florida capital marker",
      alt: "A simple diagram marking the capital of Florida.",
      placement: "q1",
      viewBox: "0 0 200 120",
      elements: [
        {
          type: "circle",
          cx: 100,
          cy: 60,
          r: 20,
          fill: "none",
          stroke: "currentColor",
        },
      ],
    },
  ],
  imageRequests: [],
};

export const validLesson: GeneratedLesson = {
  title: "Florida Pop Quiz",
  overview:
    "A short classroom pop quiz that checks student knowledge about Florida geography, history, and symbols.",
  objectives: ["Identify key Florida facts", "Answer concise quiz questions"],
  visuals: validPlan.visuals,
  sections: [
    {
      heading: "Quiz Instructions",
      body:
        "Read each question carefully and answer in a complete sentence when possible. Use what you know about Florida's places, climate, and state symbols.",
      examples: ["Florida is a state in the southeastern United States."],
    },
  ],
  questions: validPlan.questions,
};

export function buildLessonRow(overrides: Partial<LessonRow> = {}): LessonRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    outline: "A 10 question pop quiz on Florida",
    title: "Florida Pop Quiz",
    status: "generated",
    typescript_source: "export default {} satisfies GeneratedLesson;",
    lesson_json: validLesson,
    planning_typescript_source: "export default {} satisfies LessonPlan;",
    planning_json: validPlan,
    trace_id: "trace-id",
    trace_url: "https://langfuse.example/trace/trace-id",
    error_message: null,
    attempt_count: 1,
    created_at: "2026-05-08T12:00:00.000Z",
    updated_at: "2026-05-08T12:01:00.000Z",
    ...overrides,
  };
}
