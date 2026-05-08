import Link from "next/link";

import { AstralLogo } from "@/components/astral-logo";

export function AppNavbar() {
  return (
    <nav className="border-b border-black/10 bg-white/65 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-center px-5">
        <Link
          className="inline-flex min-w-0 items-center justify-center gap-3 rounded-md px-3 py-2 font-semibold text-black transition-all duration-200 hover:-translate-y-0.5 hover:bg-black/[0.04] focus:outline-none focus:ring-4 focus:ring-blue-500/20"
          href="/"
        >
          <AstralLogo className="h-8 w-8 shrink-0 text-black" />
          <span className="truncate">Lesson Generator</span>
        </Link>
      </div>
    </nav>
  );
}
