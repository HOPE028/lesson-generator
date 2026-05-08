import { beforeEach, describe, expect, it, vi } from "vitest";

import { validLesson, validPlan } from "@/tests/fixtures/lessons";

const { parseMock, forceFlushMock } = vi.hoisted(() => ({
  parseMock: vi.fn(),
  forceFlushMock: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn(function OpenAI() {
    return {
      responses: {
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
    parseMock.mockResolvedValue({
      output_parsed: {
        title: validLesson.title,
        typescriptSource: `export default ${JSON.stringify(validLesson)} satisfies GeneratedLesson;`,
      },
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

    expect(parseMock).toHaveBeenCalledTimes(1);
    expect(result.lesson.title).toBe(validLesson.title);
    expect(warn).toHaveBeenCalledWith(
      "Mark lesson validating failed:",
      expect.any(Error),
    );
  });
});
