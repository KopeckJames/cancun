"use server"

import { compressAndSaveImage, compressAndSaveVideo, saveMetadataToPostgres, getMediaRegistry, MediaMetadata } from "@/lib/storage";
import exifr from "exifr";
import { revalidatePath } from "next/cache";

export async function saveUploadedMediaRecord(payload: { url: string; type: string; lastModifiedDate?: number }) {
  try {
    const isImage = payload.type.startsWith("image/");
    const isVideo = payload.type.startsWith("video/");
    
    if (!isImage && !isVideo) {
      return { success: false, error: "Invalid file type. Only images and videos are allowed." };
    }

    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    
    let dateTaken: string | null = null;
    if (payload.lastModifiedDate) {
      dateTaken = new Date(payload.lastModifiedDate).toISOString();
    }
    
    const metadata: MediaMetadata = {
      id,
      url: payload.url,
      type: isImage ? "image" : "video",
      dateTaken,
      uploadedAt: new Date().toISOString(),
      // We skip width/height for client uploads purely for simplicity, 
      // they can be inferred via CSS or loaded asynchronously later.
      width: undefined,
      height: undefined
    };
    
    await saveMetadataToPostgres(metadata);
    revalidatePath("/");
    
    return { success: true, metadata };
  } catch (err: any) {
    console.error("Upload save error:", err);
    return { success: false, error: err.message };
  }
}

export async function getMedia() {
  return await getMediaRegistry();
}
