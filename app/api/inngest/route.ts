import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { generateLessonFunction } from "@/inngest/generate-lesson";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateLessonFunction],
});
