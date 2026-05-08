import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildLessonRow } from "@/tests/fixtures/lessons";

const {
  createLessonMock,
  deleteLessonMock,
  getLessonMock,
  listLessonsMock,
  markLessonFailedMock,
  createTraceIdMock,
  ensureLangfuseTracingMock,
  inngestSendMock,
} = vi.hoisted(() => ({
  createLessonMock: vi.fn(),
  deleteLessonMock: vi.fn(),
  getLessonMock: vi.fn(),
  listLessonsMock: vi.fn(),
  markLessonFailedMock: vi.fn(),
  createTraceIdMock: vi.fn(),
  ensureLangfuseTracingMock: vi.fn(),
  inngestSendMock: vi.fn(),
}));

vi.mock("@/lib/lessons/repository", () => ({
  createLesson: createLessonMock,
  deleteLesson: deleteLessonMock,
  getLesson: getLessonMock,
  listLessons: listLessonsMock,
  markLessonFailed: markLessonFailedMock,
}));

vi.mock("@langfuse/tracing", () => ({
  createTraceId: createTraceIdMock,
}));

vi.mock("@/lib/langfuse", () => ({
  ensureLangfuseTracing: ensureLangfuseTracingMock,
}));

vi.mock("@/inngest/client", () => ({
  inngest: {
    send: inngestSendMock,
  },
}));

describe("lessons API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns lessons from GET /api/lessons", async () => {
    const row = buildLessonRow();
    listLessonsMock.mockResolvedValue([row]);

    const route = await import("@/app/api/lessons/route");
    const response = await route.GET();

    await expect(response.json()).resolves.toEqual({ lessons: [row] });
    expect(response.status).toBe(200);
  });

  it("returns 500 when lesson listing fails", async () => {
    listLessonsMock.mockRejectedValue(new Error("db down"));

    const route = await import("@/app/api/lessons/route");
    const response = await route.GET();

    await expect(response.json()).resolves.toEqual({ error: "db down" });
    expect(response.status).toBe(500);
  });

  it("creates a lesson, trace, and Inngest event from POST /api/lessons", async () => {
    const row = buildLessonRow({ status: "planning", title: "Untitled lesson" });
    createLessonMock.mockResolvedValue(row);
    createTraceIdMock.mockResolvedValue("trace-id");
    inngestSendMock.mockResolvedValue(undefined);

    const route = await import("@/app/api/lessons/route");
    const response = await route.POST(
      new Request("http://test.local/api/lessons", {
        method: "POST",
        body: JSON.stringify({ outline: row.outline }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ lesson: row });
    expect(response.status).toBe(201);
    expect(createLessonMock).toHaveBeenCalledWith(row.outline);
    expect(createTraceIdMock).toHaveBeenCalledWith(row.id);
    expect(inngestSendMock).toHaveBeenCalledWith({
      name: "lesson.generate",
      data: { lessonId: row.id, traceId: "trace-id" },
    });
  });

  it("marks a created lesson failed when queueing generation fails", async () => {
    const row = buildLessonRow({ status: "planning", title: "Untitled lesson" });
    createLessonMock.mockResolvedValue(row);
    createTraceIdMock.mockResolvedValue("trace-id");
    inngestSendMock.mockRejectedValue(new Error("missing event key"));
    markLessonFailedMock.mockResolvedValue(undefined);

    const route = await import("@/app/api/lessons/route");
    const response = await route.POST(
      new Request("http://test.local/api/lessons", {
        method: "POST",
        body: JSON.stringify({ outline: row.outline }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Unable to queue lesson generation: missing event key",
    });
    expect(response.status).toBe(400);
    expect(markLessonFailedMock).toHaveBeenCalledWith(
      row.id,
      "Unable to queue lesson generation: missing event key",
    );
  });

  it("shows a local Inngest hint when dev queueing cannot connect", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const row = buildLessonRow({ status: "planning", title: "Untitled lesson" });
    const message =
      "Unable to queue lesson generation: Inngest dev server is not reachable. Run `bun run dev:inngest` in another terminal, then try again.";
    createLessonMock.mockResolvedValue(row);
    createTraceIdMock.mockResolvedValue("trace-id");
    inngestSendMock.mockRejectedValue(new Error("fetch failed"));
    markLessonFailedMock.mockResolvedValue(undefined);

    const route = await import("@/app/api/lessons/route");
    const response = await route.POST(
      new Request("http://test.local/api/lessons", {
        method: "POST",
        body: JSON.stringify({ outline: row.outline }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ error: message });
    expect(response.status).toBe(400);
    expect(markLessonFailedMock).toHaveBeenCalledWith(row.id, message);
  });

  it("rejects invalid POST outlines", async () => {
    const route = await import("@/app/api/lessons/route");
    const response = await route.POST(
      new Request("http://test.local/api/lessons", {
        method: "POST",
        body: JSON.stringify({ outline: "short" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createLessonMock).not.toHaveBeenCalled();
  });

  it("returns a lesson, not found, and deletion responses by id", async () => {
    const row = buildLessonRow();
    getLessonMock.mockResolvedValueOnce(row).mockResolvedValueOnce(null).mockResolvedValueOnce(row);
    deleteLessonMock.mockResolvedValue(undefined);

    const route = await import("@/app/api/lessons/[id]/route");
    const params = { params: Promise.resolve({ id: row.id }) };

    const found = await route.GET(new Request("http://test.local"), params);
    const missing = await route.GET(new Request("http://test.local"), params);
    const deleted = await route.DELETE(new Request("http://test.local"), params);

    await expect(found.json()).resolves.toEqual({ lesson: row });
    expect(found.status).toBe(200);
    await expect(missing.json()).resolves.toEqual({ error: "Lesson not found." });
    expect(missing.status).toBe(404);
    await expect(deleted.json()).resolves.toEqual({ lesson: row });
    expect(deleteLessonMock).toHaveBeenCalledWith(row.id);
  });
});
