// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GenerateLessonsApp } from "@/components/lessons/generate-lessons-app";
import { buildLessonRow } from "@/tests/fixtures/lessons";

const { pushMock, removeChannelMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  removeChannelMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ name: "lessons" }),
    }),
    removeChannel: removeChannelMock,
  }),
}));

describe("GenerateLessonsApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("shows a table loading animation while lessons are loading", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    render(<GenerateLessonsApp />);

    expect(screen.getByText("Loading lessons...")).toBeInTheDocument();
    expect(screen.queryByText("No lessons generated yet.")).not.toBeInTheDocument();
  });

  it("renders fetched lessons and opens generated rows", async () => {
    const row = buildLessonRow();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ lessons: [row] }),
      }),
    );

    render(<GenerateLessonsApp />);

    await screen.findByText(row.title!);
    await userEvent.click(screen.getByText(row.title!));

    expect(pushMock).toHaveBeenCalledWith(`/lessons/${row.id}`);
    expect(screen.getByText("Opening lesson...")).toBeInTheDocument();
  });

  it("copy link action does not navigate the row", async () => {
    const row = buildLessonRow();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ lessons: [row] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<GenerateLessonsApp />);

    await screen.findByText(row.title!);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `http://localhost:3000/lessons/${row.id}`,
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("submits outlines and prepends the returned lesson", async () => {
    const newRow = buildLessonRow({
      id: "22222222-2222-4222-8222-222222222222",
      title: "Untitled lesson",
      status: "planning",
      lesson_json: null,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ lessons: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ lesson: newRow }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<GenerateLessonsApp />);
    await userEvent.type(
      screen.getByLabelText("Lesson Outline"),
      "A 10 question pop quiz on Florida",
    );
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outline: "A 10 question pop quiz on Florida" }),
      });
    });
    expect(screen.getByText(/Name being generated/)).toBeInTheDocument();
  });

  it("deletes a confirmed lesson without navigating", async () => {
    const row = buildLessonRow();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ lessons: [row] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ lesson: row }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<GenerateLessonsApp />);

    await screen.findByText(row.title!);
    await userEvent.click(screen.getByRole("button", { name: /Delete/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(`/api/lessons/${row.id}`, {
        method: "DELETE",
      });
    });
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.queryByText(row.title!)).not.toBeInTheDocument();
  });
});
