// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  CopyLinkButton,
  getLessonUrl,
} from "@/components/lessons/copy-link-button";

describe("CopyLinkButton", () => {
  it("builds browser lesson URLs", () => {
    expect(getLessonUrl("lesson-1")).toBe("http://localhost:3000/lessons/lesson-1");
  });

  it("copies the lesson URL and shows copied state", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(<CopyLinkButton label="Copy" lessonId="lesson-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith(
      "http://localhost:3000/lessons/lesson-1",
    );
    await waitFor(() => {
      expect(screen.getByText("Copied")).toBeInTheDocument();
    });
  });
});
