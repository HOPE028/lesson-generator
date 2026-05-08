import { cn } from "@/lib/utils";
import type { LessonStatus } from "@/lib/lessons/schema";
import { AnimatedLoadingText } from "@/components/lessons/animated-loading-text";

const statusStyles: Record<LessonStatus, string> = {
  planning: "border-black/15 bg-[#f6f3ec] text-black",
  generating: "border-black/15 bg-[#f6f3ec] text-black",
  validating: "border-black/15 bg-[#f6f3ec] text-black",
  generated: "border-black bg-black text-white",
  failed: "border-red-200 bg-red-50 text-red-700",
};

export function StatusBadge({ status }: { status: LessonStatus }) {
  const isAnimatedStatus = ["planning", "generating", "validating"].includes(status);

  return (
    <span
      className={cn(
        "inline-flex min-w-24 rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-all duration-200",
        statusStyles[status],
      )}
    >
      {isAnimatedStatus ? <AnimatedLoadingText text={status} /> : status}
    </span>
  );
}
