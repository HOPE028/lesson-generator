import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildLessonRow, validLesson, validPlan } from "@/tests/fixtures/lessons";

type QueryMock = {
  select: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

function createQueryMock(): QueryMock {
  const query = {
    select: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.insert.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.delete.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  return query;
}

function mockSupabaseWithQueries(...queries: QueryMock[]) {
  const from = vi.fn();
  queries.forEach((query) => from.mockReturnValueOnce(query));
  createAdminClientMock.mockReturnValue({ from });
  return { from };
}

describe("lesson repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("lists valid lessons and skips invalid rows", async () => {
    const query = createQueryMock();
    const validRow = buildLessonRow();
    query.order.mockResolvedValue({
      data: [validRow, { ...validRow, id: "not-a-uuid" }],
      error: null,
    });
    mockSupabaseWithQueries(query);

    const { listLessons } = await import("@/lib/lessons/repository");

    await expect(listLessons()).resolves.toEqual([validRow]);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Skipping invalid lesson row"),
      expect.any(Object),
    );
  });

  it("throws Supabase errors while listing lessons", async () => {
    const query = createQueryMock();
    query.order.mockResolvedValue({ data: null, error: new Error("db down") });
    mockSupabaseWithQueries(query);

    const { listLessons } = await import("@/lib/lessons/repository");

    await expect(listLessons()).rejects.toThrow("db down");
  });

  it("creates lessons with the initial planning state", async () => {
    const query = createQueryMock();
    const row = buildLessonRow({
      title: "Untitled lesson",
      status: "planning",
      lesson_json: null,
      typescript_source: null,
      attempt_count: 0,
    });
    query.single.mockResolvedValue({ data: row, error: null });
    mockSupabaseWithQueries(query);

    const { createLesson } = await import("@/lib/lessons/repository");

    await expect(createLesson(row.outline)).resolves.toEqual(row);
    expect(query.insert).toHaveBeenCalledWith({
      outline: row.outline,
      title: "Untitled lesson",
      status: "planning",
      attempt_count: 0,
    });
  });

  it("persists planning and generated lesson state", async () => {
    const planningQuery = createQueryMock();
    const generatedQuery = createQueryMock();
    planningQuery.eq.mockResolvedValue({ error: null });
    generatedQuery.eq.mockResolvedValue({ error: null });
    mockSupabaseWithQueries(planningQuery, generatedQuery);

    const { markPlanningComplete, markLessonGenerated } = await import(
      "@/lib/lessons/repository"
    );

    await markPlanningComplete({
      id: "lesson-id",
      plan: validPlan,
      planningSource: "planning source",
    });
    await markLessonGenerated({
      id: "lesson-id",
      lesson: validLesson,
      typescriptSource: "lesson source",
      traceId: "trace-id",
      traceUrl: "https://langfuse.example/trace/trace-id",
    });

    expect(planningQuery.update).toHaveBeenCalledWith({
      title: validPlan.title,
      status: "generating",
      planning_json: validPlan,
      planning_typescript_source: "planning source",
    });
    expect(generatedQuery.update).toHaveBeenCalledWith({
      title: validLesson.title,
      status: "generated",
      lesson_json: validLesson,
      typescript_source: "lesson source",
      trace_id: "trace-id",
      trace_url: "https://langfuse.example/trace/trace-id",
      error_message: null,
    });
  });

  it("truncates failed lesson errors and deletes by id", async () => {
    const failedQuery = createQueryMock();
    const deleteQuery = createQueryMock();
    failedQuery.eq.mockResolvedValue({ error: null });
    deleteQuery.eq.mockResolvedValue({ error: null });
    mockSupabaseWithQueries(failedQuery, deleteQuery);

    const { deleteLesson, markLessonFailed } = await import(
      "@/lib/lessons/repository"
    );

    await markLessonFailed("lesson-id", "x".repeat(2100));
    await deleteLesson("lesson-id");

    expect(failedQuery.update).toHaveBeenCalledWith({
      status: "failed",
      error_message: "x".repeat(2000),
    });
    expect(deleteQuery.delete).toHaveBeenCalled();
    expect(deleteQuery.eq).toHaveBeenCalledWith("id", "lesson-id");
  });
});
