import { createAdminClient } from "@/lib/supabase/admin";
import {
  lessonRowSchema,
  type GeneratedLesson,
  type LessonPlan,
  type LessonRow,
  type LessonStatus,
} from "./schema";

const LESSON_SELECT =
  "id, outline, title, status, typescript_source, lesson_json, planning_typescript_source, planning_json, trace_id, trace_url, error_message, attempt_count, created_at, updated_at";

function parseLessonRow(data: unknown): LessonRow | null {
  const result = lessonRowSchema.safeParse(data);

  if (!result.success) {
    const id =
      data && typeof data === "object" && "id" in data
        ? String(data.id)
        : "unknown";
    console.warn(`Skipping invalid lesson row ${id}:`, result.error.flatten());
    return null;
  }

  return result.data;
}

export async function listLessons(): Promise<LessonRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("lessons")
    .select(LESSON_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).flatMap((row) => {
    const lesson = parseLessonRow(row);
    return lesson ? [lesson] : [];
  });
}

export async function getLesson(id: string): Promise<LessonRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("lessons")
    .select(LESSON_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? lessonRowSchema.parse(data) : null;
}

export async function createLesson(outline: string): Promise<LessonRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("lessons")
    .insert({
      outline,
      title: "Untitled lesson",
      status: "planning",
      attempt_count: 0,
    })
    .select(LESSON_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return lessonRowSchema.parse(data);
}

export async function updateLessonStatus(id: string, status: LessonStatus) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("lessons").update({ status }).eq("id", id);

  if (error) {
    throw error;
  }
}

export async function markPlanningComplete(params: {
  id: string;
  plan: LessonPlan;
  planningSource: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("lessons")
    .update({
      title: params.plan.title,
      status: "generating",
      planning_json: params.plan,
      planning_typescript_source: params.planningSource,
    })
    .eq("id", params.id);

  if (error) {
    throw error;
  }
}

export async function markLessonGenerated(params: {
  id: string;
  lesson: GeneratedLesson;
  typescriptSource: string;
  traceId: string;
  traceUrl: string | null;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("lessons")
    .update({
      title: params.lesson.title,
      status: "generated",
      lesson_json: params.lesson,
      typescript_source: params.typescriptSource,
      trace_id: params.traceId,
      trace_url: params.traceUrl,
      error_message: null,
    })
    .eq("id", params.id);

  if (error) {
    throw error;
  }
}

export async function markLessonFailed(id: string, errorMessage: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("lessons")
    .update({
      status: "failed",
      error_message: errorMessage.slice(0, 2000),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function incrementAttempt(id: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("lessons")
    .select("attempt_count")
    .eq("id", id)
    .single();

  const nextAttempt = Number(data?.attempt_count ?? 0) + 1;

  const { error } = await supabase
    .from("lessons")
    .update({ attempt_count: nextAttempt })
    .eq("id", id);

  if (error) {
    throw error;
  }
}
