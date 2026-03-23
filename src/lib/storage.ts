import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

// Configure ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export interface MediaMetadata {
  id: string;
  url: string;
  type: "image" | "video";
  dateTaken: string | null;
  uploadedAt: string;
  width?: number;
  height?: number;
}

const DB_PATH = path.join(process.cwd(), "public", "db.json");
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const TMP_DIR = path.join(process.cwd(), "public", "tmp");

async function init() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.mkdir(TMP_DIR, { recursive: true });
  } catch (e) {
    // Ignore
  }
  
  try {
    await fs.access(DB_PATH);
  } catch (e) {
    await fs.writeFile(DB_PATH, JSON.stringify([]), "utf-8");
  }
}

init().catch(console.error);

export async function compressAndSaveImage(buffer: Buffer): Promise<{ url: string; width: number; height: number }> {
  const uniquePrefix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const filename = `${uniquePrefix}.webp`;
  const destPath = path.join(UPLOAD_DIR, filename);

  // Compress to WebP with sharp
  const info = await sharp(buffer)
    .resize({ width: 1920, withoutEnlargement: true }) // Max width 1920px
    .webp({ quality: 80 })
    .toFile(destPath);

  return {
    url: `/uploads/${filename}`,
    width: info.width,
    height: info.height
  };
}

export async function compressAndSaveVideo(buffer: Buffer): Promise<string> {
  const uniquePrefix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const tempPath = path.join(TMP_DIR, `${uniquePrefix}-temp.mp4`);
  const filename = `${uniquePrefix}.mp4`;
  const destPath = path.join(UPLOAD_DIR, filename);

  // Write temporary file because ffmpeg needs a file path
  await fs.writeFile(tempPath, buffer);

  return new Promise((resolve, reject) => {
    ffmpeg(tempPath)
      // Transcode and compress video heavily for fast web loading and autoplay
      .outputOptions([
        '-c:v libx264',
        '-crf 28',         // High compression
        '-preset veryfast',// Fast encoding
        '-c:a aac',
        '-b:a 128k',
        '-vf scale=-2:720',// Downscale to 720p height, preserving aspect ratio (width divisible by 2)
        '-movflags +faststart' // Crucial for quick streaming/autoplay on web
      ])
      .save(destPath)
      .on('end', async () => {
        // Cleanup temp file
        try {
          await fs.unlink(tempPath);
        } catch(e) {}
        resolve(`/uploads/${filename}`);
      })
      .on('error', async (err) => {
        try {
          await fs.unlink(tempPath);
        } catch(e) {}
        reject(err);
      });
  });
}

export async function saveMetadata(metadata: MediaMetadata): Promise<void> {
  try {
    const data = await fs.readFile(DB_PATH, "utf-8");
    const existing = JSON.parse(data) as MediaMetadata[];
    existing.push(metadata);
    await fs.writeFile(DB_PATH, JSON.stringify(existing, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save metadata", error);
  }
}

export async function getMediaRegistry(): Promise<MediaMetadata[]> {
  try {
    const data = await fs.readFile(DB_PATH, "utf-8");
    const existing = JSON.parse(data) as MediaMetadata[];
    return existing.sort((a, b) => {
      const dateA = a.dateTaken ? new Date(a.dateTaken).getTime() : new Date(a.uploadedAt).getTime();
      const dateB = b.dateTaken ? new Date(b.dateTaken).getTime() : new Date(b.uploadedAt).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    return [];
  }
}
