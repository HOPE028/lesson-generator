# Lesson Generator

A two-page full-stack Next.js application for generating classroom lessons from a short outline. The app stores lesson jobs in Supabase, runs generation through Inngest, validates AI-produced TypeScript before saving it, and traces the workflow with Langfuse.

Production: https://lesson-generator-bay.vercel.app

## Features

- Generate lessons from outlines like `A 10 question pop quiz on Florida`.
- Track lesson status through `planning`, `generating`, `validating`, `generated`, and `failed`.
- View generated lessons at `/lessons/[id]` without needing auth.
- Render structured generated TypeScript in the browser after validation.
- Support multiple-choice interactive quiz mode and printable question-sheet mode.
- Render safe structured SVG visuals with PNG download buttons.
- Copy lesson links and delete lessons from the table.
- Trace AI planning, generation, validation, and repair attempts in Langfuse.

## Architecture

- `app/` contains Next.js App Router pages and route handlers.
- `components/lessons/` contains the lesson table, renderer, quiz UI, status badges, copy buttons, and SVG visual renderer.
- `lib/lessons/` contains schemas, Supabase repository functions, generation orchestration, and TypeScript validation.
- `inngest/` defines the background lesson-generation workflow.
- `supabase/migrations/` defines the `lessons` table and planning-phase columns.
- `tests/` contains Vitest unit tests for schemas, validation, repository behavior, API routes, and key React interactions.

## Setup

Install dependencies with Bun:

```bash
bun install
```

Create `.env` or `.env.local` from `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-5.5
INNGEST_EVENT_KEY=your-inngest-event-key
INNGEST_SIGNING_KEY=your-inngest-signing-key
LANGFUSE_PUBLIC_KEY=your-langfuse-public-key
LANGFUSE_SECRET_KEY=your-langfuse-secret-key
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `INNGEST_SIGNING_KEY`, or `LANGFUSE_SECRET_KEY` to the browser.

## Database

Apply Supabase migrations after logging in and linking the project:

```bash
bunx supabase login
bunx supabase link --project-ref <project-ref>
bunx supabase db push
```

The app uses Supabase Realtime on the `lessons` table so the lesson list can update without refreshing.

## Development

Start the Next.js app:

```bash
bun run dev
```

Start the Inngest dev server in another terminal:

```bash
bunx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Then open http://localhost:3000.

## Testing And Quality

```bash
bun run test        # run Vitest unit tests
bun run test:watch  # run Vitest in watch mode
bun run lint        # run ESLint
bun run build       # production build and TypeScript check
```

The unit tests mock Supabase, Inngest, Langfuse, browser clipboard APIs, and routing. They should not call real external services.

## AI Generation Safety

The generator has separate planning and generation phases. Planning produces a typed `LessonPlan`; generation produces a typed `GeneratedLesson`. Both are returned as TypeScript source and parsed with the TypeScript compiler API.

Validation rejects imports, variables, functions, calls, classes, unsafe object shapes, malformed syntax, and schema-invalid lesson content. Only JSON-compatible default-exported objects that satisfy the Zod schemas are saved.

## Deployment

Deploy with Vercel:

```bash
bunx vercel deploy --prod
```

Set production environment variables in Vercel project settings instead of relying on a local `.env` file during deploys. The app also requires the deployed Inngest endpoint at `/api/inngest` to be reachable so background generation can run.
