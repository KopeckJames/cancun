import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { put } from "@vercel/blob";
import { sql } from "@vercel/postgres";

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

const TMP_DIR = path.join(process.cwd(), "public", "tmp");

async function init() {
  try {
    await fs.mkdir(TMP_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}

init().catch(console.error);

/** Helper to upload a Buffer to Vercel Blob */
async function uploadToBlob(buffer: Buffer, mime: string, filename: string): Promise<string> {
  const { url } = await put(filename, buffer, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: mime,
  });
  return url;
}

/** Save metadata to Vercel Postgres */
export async function saveMetadataToPostgres(metadata: MediaMetadata): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      type TEXT NOT NULL,
      date_taken TIMESTAMP NULL,
      uploaded_at TIMESTAMP NOT NULL,
      width INTEGER NULL,
      height INTEGER NULL
    );
  `;
  await sql`
    INSERT INTO media (id, url, type, date_taken, uploaded_at, width, height)
    VALUES (
      ${metadata.id},
      ${metadata.url},
      ${metadata.type},
      ${metadata.dateTaken ? new Date(metadata.dateTaken) : null},
      ${new Date(metadata.uploadedAt)},
      ${metadata.width ?? null},
      ${metadata.height ?? null}
    );
  `;
}

/** Retrieve all media metadata ordered by date */
export async function getMediaRegistry(): Promise<MediaMetadata[]> {
  const rows = await sql`SELECT * FROM media ORDER BY COALESCE(date_taken, uploaded_at) DESC`;
  return rows.map((row: any) => ({
    id: row.id,
    url: row.url,
    type: row.type as "image" | "video",
    dateTaken: row.date_taken ? new Date(row.date_taken).toISOString() : null,
    uploadedAt: new Date(row.uploaded_at).toISOString(),
    width: row.width ?? undefined,
    height: row.height ?? undefined,
  }));
}

/** Compress image and upload to Blob */
export async function compressAndSaveImage(buffer: Buffer): Promise<{ url: string; width: number; height: number }> {
  const uniquePrefix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const filename = `${uniquePrefix}.webp`;
  const { data, info } = await sharp(buffer)
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  const url = await uploadToBlob(data, "image/webp", filename);
  return { url, width: info.width, height: info.height };
}

/** Compress video, transcode, and upload to Blob */
export async function compressAndSaveVideo(buffer: Buffer): Promise<string> {
  const uniquePrefix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const tempPath = path.join(TMP_DIR, `${uniquePrefix}-temp.mp4`);
  const outputPath = path.join(TMP_DIR, `${uniquePrefix}.mp4`);
  await fs.writeFile(tempPath, buffer);
  return new Promise<string>((resolve, reject) => {
    ffmpeg(tempPath)
      .outputOptions([
        "-c:v libx264",
        "-crf 28",
        "-preset veryfast",
        "-c:a aac",
        "-b:a 128k",
        "-vf scale=-2:720",
        "-movflags +faststart",
      ])
      .save(outputPath)
      .on("end", async () => {
        try {
          const outBuffer = await fs.readFile(outputPath);
          const filename = `${uniquePrefix}.mp4`;
          const url = await uploadToBlob(outBuffer, "video/mp4", filename);
          await fs.unlink(tempPath).catch(() => {});
          await fs.unlink(outputPath).catch(() => {});
          resolve(url);
        } catch (e) {
          reject(e);
        }
      })
      .on("error", async (err) => {
        await fs.unlink(tempPath).catch(() => {});
        await fs.unlink(outputPath).catch(() => {});
        reject(err);
      });
  });
}
