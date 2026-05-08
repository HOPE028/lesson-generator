import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

declare global {
  var __lessonGeneratorLangfuse:
    | {
        sdk: NodeSDK;
        processor: LangfuseSpanProcessor;
        started: boolean;
      }
    | undefined;
}

function maskSecrets(data: unknown): unknown {
  if (typeof data === "string") {
    return data
      .replace(/sk-[a-zA-Z0-9_-]+/g, "sk-***")
      .replace(/service_role[a-zA-Z0-9._-]+/g, "service_role***");
  }

  return data;
}

function createLangfuseSdk() {
  const processor = new LangfuseSpanProcessor({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    mask: ({ data }) => maskSecrets(data),
  });

  return {
    processor,
    sdk: new NodeSDK({
      spanProcessors: [processor],
    }),
    started: false,
  };
}

export function ensureLangfuseTracing() {
  if (!globalThis.__lessonGeneratorLangfuse) {
    globalThis.__lessonGeneratorLangfuse = createLangfuseSdk();
  }

  const instance = globalThis.__lessonGeneratorLangfuse;

  if (!instance.started) {
    instance.sdk.start();
    instance.started = true;
  }

  return instance;
}

export async function flushLangfuse() {
  const instance = globalThis.__lessonGeneratorLangfuse;

  if (instance?.started) {
    await instance.processor.forceFlush();
  }
}

export function getLangfuseTraceUrl(traceId: string) {
  const baseUrl = process.env.LANGFUSE_BASE_URL;

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl.replace(/\/$/, "")}/trace/${traceId}`;
}
