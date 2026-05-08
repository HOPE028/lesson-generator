# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js App Router project for generating and viewing TypeScript-backed lessons. It uses Supabase for persistence, Inngest for async lesson generation, OpenAI for content generation, Langfuse for tracing/evaluation, Tailwind CSS, and shadcn/ui-style components.

- `app/` contains routes, layouts, pages, and route handlers. The home page is `app/page.tsx`; individual lesson pages live in `app/lessons/[id]/`; API routes live in `app/api/lessons/` and `app/api/inngest/`.
- `components/` contains reusable React components. Shared primitives are in `components/ui/`; lesson UI is grouped in `components/lessons/`; app branding lives in `components/app-navbar.tsx` and `components/astral-logo.tsx`.
- `lib/` contains shared utilities, Supabase client/server/admin helpers, lesson generation/repository/schema code, time utilities, and Langfuse setup. Use the `@/*` TypeScript path alias for root-relative imports.
- `inngest/` contains the Inngest client and lesson generation function.
- `tests/` contains Vitest coverage for focused utilities and validation logic.
- `supabase/migrations/` contains database schema changes for lesson storage and planning state.
- `app/globals.css`, `tailwind.config.ts`, and `components.json` define styling and UI conventions. `app/icon.svg` is the website favicon.
- `.env.example` documents required local environment variables for Supabase, OpenAI, Inngest, and Langfuse.

## Build, Test, and Development Commands

Use Bun because this repository includes `bun.lock`.

```bash
bun install      # install dependencies
bun run dev      # start the Next.js dev server
bun run build    # create a production build
bun run start    # run the production server
bun run lint     # run ESLint across the repository
bun run test     # run Vitest tests once
bun run test:watch # run Vitest in watch mode
bun run eval:generation # run the lesson generation evaluation script
```

The app expects the Supabase public URL/key, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, Inngest keys, and Langfuse keys in `.env.local`; copy `.env.example` as a starting point. `OPENAI_MODEL` defaults should be kept in `.env.local` rather than hard-coded.

## Coding Style & Naming Conventions

Write TypeScript and React function components. Keep files and directories lowercase with hyphens, matching names such as `login-form.tsx` and `update-password-form.tsx`. Use PascalCase for component exports and camelCase for functions, variables, and hooks.

Formatting follows the existing Next.js/TypeScript style: two-space indentation, double quotes, semicolons, and Tailwind utility classes in JSX. Prefer `cn` from `lib/utils.ts` for class merging, and reuse `components/ui/` primitives before adding new UI patterns. Keep lesson-specific UI in `components/lessons/` and shared chrome in top-level `components/`.

## Testing Guidelines

Vitest is configured for focused unit tests. For changes, run `bun run lint`, `bun run test`, and `bun run build` before opening a PR. Add tests in `tests/` or next to the code when changing reusable utilities, validation behavior, or generation schema logic. Use descriptive names like `typescript-validator.test.ts`.

## Commit & Pull Request Guidelines

Use short, imperative commit messages such as `Add planning summary state` or `Fix lesson validation error`.

Pull requests should include a concise summary, verification steps, and screenshots for visible UI changes. Link related issues when available, mention any environment variable or migration changes, and keep PRs scoped to one feature or fix.

## Security & Configuration Tips

Do not commit `.env.local`, Supabase secrets, OpenAI keys, Inngest signing/event keys, or Langfuse secret keys. Only expose `NEXT_PUBLIC_` values when they are safe for the browser. Keep service-role Supabase access in server-only helpers, route handlers, or Inngest functions, and avoid importing admin clients into client components.
