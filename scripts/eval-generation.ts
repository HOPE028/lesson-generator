const outlines = [
  "A 10 question pop quiz on Florida",
  "A one-pager on how to divide with long division",
  "An explanation of how the Cartesian Grid works and an example of finding distances between points",
  "A test on counting numbers",
  "A short lesson on why plants need sunlight",
  "A review sheet about fractions and equivalent fractions",
  "A five question warm-up on state capitals",
  "A beginner lesson on subject and predicate",
  "A mini quiz about the water cycle",
  "A one-page introduction to prime numbers",
];

const baseUrl = process.env.EVAL_BASE_URL || "http://localhost:3000";

async function createLesson(outline: string) {
  const response = await fetch(`${baseUrl}/api/lessons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outline }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Failed to create lesson for: ${outline}`);
  }

  return data.lesson.id as string;
}

async function waitForLesson(id: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 180_000) {
    const response = await fetch(`${baseUrl}/api/lessons/${id}`, {
      cache: "no-store",
    });
    const data = await response.json();

    if (data.lesson?.status === "generated") {
      return data.lesson;
    }

    if (data.lesson?.status === "failed") {
      throw new Error(data.lesson.error_message || `Lesson ${id} failed.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error(`Timed out waiting for lesson ${id}.`);
}

async function main() {
  const ids = [];

  for (const outline of outlines) {
    ids.push(await createLesson(outline));
  }

  const lessons = await Promise.all(ids.map((id) => waitForLesson(id)));
  console.log(`Generated ${lessons.length}/${outlines.length} lessons successfully.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
