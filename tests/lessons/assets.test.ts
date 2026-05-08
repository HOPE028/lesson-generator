import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

describe("lesson assets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads lesson images to the public lesson assets bucket", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: {
        publicUrl:
          "https://example.supabase.co/storage/v1/object/public/lesson-assets/lessons/lesson-id/image-id.webp",
      },
    });
    const from = vi.fn().mockReturnValue({ upload, getPublicUrl });
    createAdminClientMock.mockReturnValue({ storage: { from } });

    const { uploadLessonImage } = await import("@/lib/lessons/assets");
    const result = await uploadLessonImage({
      lessonId: "lesson-id",
      imageId: "image-id",
      image: Buffer.from("image"),
    });

    expect(from).toHaveBeenCalledWith("lesson-assets");
    expect(upload).toHaveBeenCalledWith(
      "lessons/lesson-id/image-id.webp",
      Buffer.from("image"),
      {
        cacheControl: "31536000",
        contentType: "image/webp",
        upsert: true,
      },
    );
    expect(getPublicUrl).toHaveBeenCalledWith("lessons/lesson-id/image-id.webp");
    expect(result).toEqual({
      imageUrl:
        "https://example.supabase.co/storage/v1/object/public/lesson-assets/lessons/lesson-id/image-id.webp",
      storagePath: "lessons/lesson-id/image-id.webp",
    });
  });
});
