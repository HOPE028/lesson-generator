# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js App Router project using Supabase authentication, Tailwind CSS, and shadcn/ui-style components.

- `app/` contains routes, layouts, pages, and route handlers. Auth routes live in `app/auth/`; protected content lives in `app/protected/`.
- `components/` contains reusable React components. Shared primitives are in `components/ui/`; tutorial and auth components are grouped by feature.
- `lib/` contains shared utilities and Supabase client/server helpers. Use the `@/*` TypeScript path alias for root-relative imports.
- `app/globals.css`, `tailwind.config.ts`, and `components.json` define styling and UI conventions.
- `.env.example` documents required local environment variables.

## Build, Test, and Development Commands

Use Bun because this repository includes `bun.lock`.

```bash
bun install      # install dependencies
bun run dev      # start the Next.js dev server
bun run build    # create a production build
bun run start    # run the production server
bun run lint     # run ESLint across the repository
```

The app expects `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`; copy `.env.example` as a starting point.

## Coding Style & Naming Conventions

Write TypeScript and React function components. Keep files and directories lowercase with hyphens, matching names such as `login-form.tsx` and `update-password-form.tsx`. Use PascalCase for component exports and camelCase for functions, variables, and hooks.

Formatting follows the existing Next.js/TypeScript style: two-space indentation, double quotes, semicolons, and Tailwind utility classes in JSX. Prefer `cn` from `lib/utils.ts` for class merging, and reuse `components/ui/` primitives before adding new UI patterns.

## Testing Guidelines

There is currently no test framework or `test` script configured. For changes, run `bun run lint` and `bun run build` before opening a PR. If adding tests, place them next to the code or in a clearly named `__tests__/` directory, and use descriptive names like `login-form.test.tsx`.

## Commit & Pull Request Guidelines

Git history currently only contains the initial Create Next App commit, so no project-specific convention is established. Use short, imperative commit messages such as `Add protected lesson page` or `Fix Supabase auth redirect`.

Pull requests should include a concise summary, verification steps, and screenshots for visible UI changes. Link related issues when available, mention any environment variable changes, and keep PRs scoped to one feature or fix.

## Security & Configuration Tips

Do not commit `.env.local` or Supabase secrets. Only expose `NEXT_PUBLIC_` values when they are safe for the browser. Keep auth-sensitive logic in `lib/supabase/` server helpers or route handlers.
