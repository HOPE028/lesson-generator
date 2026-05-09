import { beforeEach, describe, expect, it, vi } from "vitest";

import { validPlan } from "@/tests/fixtures/lessons";

const { createMock, parseMock, forceFlushMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  parseMock: vi.fn(),
  forceFlushMock: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn(function OpenAI() {
    return {
      responses: {
        create: createMock,
        parse: parseMock,
      },
    };
  }),
}));

vi.mock("@langfuse/openai", () => ({
  observeOpenAI: (client: unknown) => client,
}));

vi.mock("@langfuse/otel", () => ({
  LangfuseSpanProcessor: vi.fn(function LangfuseSpanProcessor() {
    return {
      forceFlush: forceFlushMock,
    };
  }),
}));

vi.mock("@opentelemetry/sdk-node", () => ({
  NodeSDK: vi.fn(function NodeSDK() {
    return {
      start: vi.fn(),
    };
  }),
}));

vi.mock("@langfuse/tracing", () => ({
  propagateAttributes: (_attributes: unknown, callback: () => unknown) => callback(),
  startActiveObservation: (
    _name: string,
    callback: (span: { update: ReturnType<typeof vi.fn> }) => unknown,
  ) => callback({ update: vi.fn() }),
}));

describe("generateLessonFromPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.__lessonGeneratorLangfuse = undefined;
    createMock.mockResolvedValue({
      output_text: `import { Quiz } from "@/components/lessons/generated-lesson-runtime";

export default function GeneratedLesson() {
  return (
    <article className="space-y-8">
      <h1>${validPlan.title}</h1>
      <Quiz questions={${JSON.stringify(validPlan.questions)}} />
    </article>
  );
}`,
    });
    forceFlushMock.mockResolvedValue(undefined);
  });

  it("does not retry valid TypeScript when an intermediate status update fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { generateLessonFromPlan } = await import("@/lib/lessons/generator");
    const result = await generateLessonFromPlan({
      outline: "A 10 question pop quiz on Florida",
      lessonId: "lesson-id",
      traceId: "8579c551e57851c86d74855dbd37b5e4",
      plan: validPlan,
      onValidating: vi.fn().mockRejectedValue(new Error("status constraint")),
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(result.title).toBe(validPlan.title);
    expect(result.renderTree).toHaveProperty("type", "article");
    expect(result.assetManifest).toHaveProperty(validPlan.visuals[0].id);
    expect(warn).toHaveBeenCalledWith(
      "Mark lesson validating failed:",
      expect.any(Error),
    );
  });
});

describe("planLesson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.__lessonGeneratorLangfuse = undefined;
    forceFlushMock.mockResolvedValue(undefined);
  });

  it("accepts planning summaries longer than 1000 characters", async () => {
    parseMock.mockResolvedValueOnce({
      output_parsed: {
        ...validPlan,
        summary: "x".repeat(1001),
      },
    });

    const { planLesson } = await import("@/lib/lessons/generator");

    await expect(
      planLesson({
        outline: "A 10 question pop quiz on Florida",
        lessonId: "lesson-id",
        traceId: "8579c551e57851c86d74855dbd37b5e4",
      }),
    ).resolves.toMatchObject({
      plan: { title: validPlan.title, summary: "x".repeat(1001) },
    });

    expect(parseMock).toHaveBeenCalledTimes(1);
  });
});
