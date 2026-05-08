export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureLangfuseTracing } = await import("@/lib/langfuse");
    ensureLangfuseTracing();
  }
}
