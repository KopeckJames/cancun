import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { put, del, list } from "@vercel/blob";
import { Pool } from "pg";

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

// Initialize a global PG pool
let pool: Pool | null = null;
export async function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.POSTGRES_URL });
    pool.on('error', (err) => {
      console.error('Unexpected PG pool error', err);
    });
  }
  return pool;
}

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
  try {
    const client = await getPool();
    await client.query(`
      CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        type TEXT NOT NULL,
        date_taken TIMESTAMP NULL,
        uploaded_at TIMESTAMP NOT NULL,
        width INTEGER NULL,
        height INTEGER NULL
      );
    `);
    await client.query(`
      INSERT INTO media (id, url, type, date_taken, uploaded_at, width, height)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      metadata.id,
      metadata.url,
      metadata.type,
      metadata.dateTaken ? metadata.dateTaken : null,
      metadata.uploadedAt,
      metadata.width ?? null,
      metadata.height ?? null,
    ]);
  } catch (e) {
    console.error('Error saving metadata to Postgres:', e);
  }
}

/** Delete a media record and its blob storage file */
export async function deleteMediaRecord(urlOrId: string): Promise<void> {
  try {
    const client = await getPool();
    // Try to find URL if id was passed
    const res = await client.query('SELECT url FROM media WHERE id = $1', [urlOrId]);
    const finalUrl = res.rows.length > 0 ? res.rows[0].url : urlOrId;
    
    // Delete from DB just in case
    await client.query('DELETE FROM media WHERE id = $1 OR url = $1', [urlOrId]);
    
    // Delete from Vercel Blob using the URL
    if (finalUrl.startsWith('https://')) {
      await del(finalUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
    }
  } catch (e) {
    console.error('Error deleting media record:', e);
    throw e;
  }
}

/** Retrieve all media directly from Vercel Blob, skipping DB, to support raw uploads */
export async function getMediaRegistry(): Promise<MediaMetadata[]> {
  try {
    const { blobs } = await list({ token: process.env.BLOB_READ_WRITE_TOKEN, limit: 1000 });
    
    const uniqueBlobs = new Map<string, any>();
    
    // Deduplicate logic
    for (const blob of blobs) {
      if (!blob.pathname) continue;
      
      const extMatch = blob.pathname.match(/(\.[^.]+)$/);
      const ext = extMatch ? extMatch[0] : '';
      const nameWithoutExt = blob.pathname.slice(0, blob.pathname.length - ext.length);
      
      let baseName = nameWithoutExt;
      const lastDashIdx = nameWithoutExt.lastIndexOf('-');
      if (lastDashIdx !== -1) {
        const potentialHash = nameWithoutExt.slice(lastDashIdx + 1);
        // Usually 22 chars or more for vercel blob, but can be shorter. Just looking for purely alphanumeric/hash-like.
        if (/^[A-Za-z0-9_]{10,}$/.test(potentialHash)) {
          baseName = nameWithoutExt.slice(0, lastDashIdx);
        }
      }
      
      const uniqueKey = (baseName + ext).toLowerCase();
      
      // If we already have it, keep the oldest upload (the original)
      if (uniqueBlobs.has(uniqueKey)) {
        const existing = uniqueBlobs.get(uniqueKey);
        if (blob.uploadedAt < existing.uploadedAt) {
          uniqueBlobs.set(uniqueKey, blob);
        }
      } else {
        uniqueBlobs.set(uniqueKey, blob);
      }
    }
    
    const dedupedBlobs = Array.from(uniqueBlobs.values());
    
    // Sort by uploadedAt descending (newest first)
    dedupedBlobs.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    
    return dedupedBlobs.map(blob => {
      const pathnameLower = blob.pathname.toLowerCase();
      const isVideo = pathnameLower.endsWith('.mp4') || pathnameLower.endsWith('.mov') || pathnameLower.endsWith('.webm') || pathnameLower.endsWith('.quicktime');
      
      return {
        id: blob.url, // Using Blob URL as ID so we can pass it to delete later
        url: blob.url,
        type: isVideo ? "video" : "image",
        dateTaken: null, // Since it's raw from Blob, we fallback to uploadedAt in UI
        uploadedAt: blob.uploadedAt.toISOString(),
      };
    });
  } catch (e) {
    console.error('Error fetching from Vercel Blob:', e);
    return [];
  }
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
