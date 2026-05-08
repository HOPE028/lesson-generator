"use client";

import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export function getLessonUrl(lessonId: string) {
  if (typeof window === "undefined") {
    return `/lessons/${lessonId}`;
  }

  return `${window.location.origin}/lessons/${lessonId}`;
}

export function CopyLinkButton({
  lessonId,
  className,
  label = "Copy link",
}: {
  lessonId: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const url = useMemo(() => getLessonUrl(lessonId), [lessonId]);

  async function copyLink(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-medium text-black transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500 hover:text-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/20",
        className,
      )}
      onClick={copyLink}
      type="button"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}
