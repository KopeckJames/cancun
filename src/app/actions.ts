"use server"

import { compressAndSaveImage, compressAndSaveVideo, saveMetadata, getMediaRegistry, MediaMetadata } from "@/lib/storage";
import exifr from "exifr";
import { revalidatePath } from "next/cache";

export async function uploadMedia(formData: FormData) {
  const file = formData.get("file") as File;
  if (!file) {
    return { success: false, error: "No file provided" };
  }

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  
  if (!isImage && !isVideo) {
    return { success: false, error: "Invalid file type. Only images and videos are allowed." };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let url = "";
    let dateTaken: string | null = null;
    let width: number | undefined;
    let height: number | undefined;

    if (isImage) {
      try {
        const exifData = await exifr.parse(buffer);
        if (exifData && exifData.DateTimeOriginal) {
          dateTaken = new Date(exifData.DateTimeOriginal).toISOString();
        }
      } catch (e) {
        console.warn("Failed to parse EXIF data:", e);
      }
      
      const res = await compressAndSaveImage(buffer);
      url = res.url;
      width = res.width;
      height = res.height;
    } else {
      url = await compressAndSaveVideo(buffer);
    }
    
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const metadata: MediaMetadata = {
      id,
      url,
      type: isImage ? "image" : "video",
      dateTaken,
      uploadedAt: new Date().toISOString(),
      width,
      height
    };
    
    await saveMetadata(metadata);
    revalidatePath("/");
    
    return { success: true, metadata };
  } catch (err: any) {
    console.error("Upload error:", err);
    return { success: false, error: err.message };
  }
}

export async function getMedia() {
  return await getMediaRegistry();
}
