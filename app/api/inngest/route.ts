import { serve } from "inngest/next";
import { after } from "next/server";

import { inngest } from "@/inngest/client";
import { generateLessonFunction } from "@/inngest/generate-lesson";
import { ensureLangfuseTracing, flushLangfuse } from "@/lib/langfuse";

export const runtime = "nodejs";
export const maxDuration = 300;

ensureLangfuseTracing();

const handlers = serve({
  client: inngest,
  functions: [generateLessonFunction],
});

function flushAfterResponse() {
  after(async () => {
    await flushLangfuse();
  });
}

export const GET = handlers.GET;

export async function POST(...args: Parameters<typeof handlers.POST>) {
  const response = await handlers.POST(...args);
  flushAfterResponse();
  return response;
}

export async function PUT(...args: Parameters<typeof handlers.PUT>) {
  const response = await handlers.PUT(...args);
  flushAfterResponse();
  return response;
}
