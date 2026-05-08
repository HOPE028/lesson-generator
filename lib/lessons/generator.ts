import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { observeOpenAI } from "langfuse";

import { aiLessonResponseSchema } from "@/lib/lessons/schema";
import { validateGeneratedLessonSource } from "@/lib/lessons/typescript-validator";

const SYSTEM_PROMPT = `You generate classroom lesson content as TypeScript.

Return an object with:
- title: a concise lesson title
- typescriptSource: TypeScript code that default-exports one JSON-compatible object satisfying GeneratedLesson.

The TypeScript source must follow this shape exactly:
export default {
  title: "...",
  overview: "...",
  objectives: ["..."],
  sections: [{ heading: "...", body: "...", examples: ["..."] }],
  questions: [{ prompt: "...", answer: "..." }]
} satisfies GeneratedLesson;

Rules:
- Do not include imports, functions, JSX, markdown fences, comments, variables, or runtime code.
- Use age-neutral, classroom-ready language.
- Include quiz questions when the outline asks for a quiz, pop quiz, or test.
- Keep content useful but compact enough for a web page.`;

function getTraceUrl(traceId: string) {
  const baseUrl = process.env.LANGFUSE_BASE_URL || process.env.LANGFUSE_BASEURL;

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl.replace(/\/$/, "")}/trace/${traceId}`;
}

async function requestLessonSource(params: {
  outline: string;
  lessonId: string;
  traceId: string;
  validationError?: string;
}) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const langfuseBaseUrl =
    process.env.LANGFUSE_BASE_URL || process.env.LANGFUSE_BASEURL;
  const tracedOpenAI = observeOpenAI(openai, {
    traceId: params.traceId,
    traceName: "lesson.generate",
    sessionId: params.lessonId,
    metadata: {
      lessonId: params.lessonId,
      outline: params.outline,
      validationError: params.validationError,
    },
    tags: ["lesson-generator"],
    clientInitParams: {
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: langfuseBaseUrl,
    },
  });

  const repairInstruction = params.validationError
    ? `\n\nThe previous TypeScript failed validation with this error. Return a corrected complete response only:\n${params.validationError}`
    : "";

  const response = await tracedOpenAI.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    instructions: SYSTEM_PROMPT,
    input: `Lesson outline: ${params.outline}${repairInstruction}`,
    text: {
      format: zodTextFormat(aiLessonResponseSchema, "lesson_generation"),
    },
  });

  await tracedOpenAI.flushAsync();

  if (!response.output_parsed) {
    throw new Error("OpenAI did not return a parseable lesson response.");
  }

  return response.output_parsed;
}

export async function generateLesson(params: {
  outline: string;
  lessonId: string;
  traceId: string;
}) {
  let validationError: string | undefined;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const generated = await requestLessonSource({
      ...params,
      validationError,
    });

    try {
      const validated = validateGeneratedLessonSource(generated.typescriptSource);

      return {
        ...validated,
        traceUrl: getTraceUrl(params.traceId),
      };
    } catch (error) {
      validationError =
        error instanceof Error ? error.message : "Unknown validation error.";

      if (attempt === 3) {
        throw new Error(`Generated TypeScript failed validation: ${validationError}`);
      }
    }
  }

  throw new Error("Generated TypeScript failed validation.");
}
