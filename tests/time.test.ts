import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "@/lib/time";

describe("formatRelativeTime", () => {
  const now = new Date("2026-05-08T12:00:00Z");

  it("formats recent timestamps", () => {
    expect(formatRelativeTime("2026-05-08T11:59:35Z", now)).toBe("just now");
  });

  it("formats minutes and hours", () => {
    expect(formatRelativeTime("2026-05-08T11:50:00Z", now)).toBe(
      "10 minutes ago",
    );
    expect(formatRelativeTime("2026-05-08T09:00:00Z", now)).toBe("3 hours ago");
  });
});
