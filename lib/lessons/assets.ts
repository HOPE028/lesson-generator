import { createAdminClient } from "@/lib/supabase/admin";

const LESSON_ASSETS_BUCKET = "lesson-assets";

export async function uploadLessonImage(params: {
  lessonId: string;
  imageId: string;
  image: Buffer;
}) {
  const supabase = createAdminClient();
  const storagePath = `lessons/${params.lessonId}/${params.imageId}.webp`;
  const bucket = supabase.storage.from(LESSON_ASSETS_BUCKET);
  const { error } = await bucket.upload(storagePath, params.image, {
    cacheControl: "31536000",
    contentType: "image/webp",
    upsert: true,
  });

  if (error) {
    throw error;
  }

  const { data } = bucket.getPublicUrl(storagePath);

  return {
    imageUrl: data.publicUrl,
    storagePath,
  };
}
