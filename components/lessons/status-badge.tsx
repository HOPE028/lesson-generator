import { cn } from "@/lib/utils";
import type { LessonStatus } from "@/lib/lessons/schema";

const statusStyles: Record<LessonStatus, string> = {
  generating: "border-blue-500/30 bg-blue-500/10 text-blue-700 animate-pulse",
  generated: "border-black bg-black text-white",
  failed: "border-red-200 bg-red-50 text-red-700",
};

export function StatusBadge({ status }: { status: LessonStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-all duration-200",
        statusStyles[status],
      )}
    >
      {status}
    </span>
  );
}
