/**
 * imageStorage.ts
 *
 * Server-side helpers for saving generated images to GCS (Replit Object Storage)
 * and streaming them back to clients.  Replaces the local `uploads/` folder so
 * images survive across deployments.
 *
 * Serving URL pattern: /api/images/<subdir>/<uuid>.<ext>
 */

import { randomUUID } from "crypto";
import { objectStorageClient } from "./objectStorage";
import { logger } from "./logger";

function bucketId(): string {
  const id = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!id) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not configured");
  return id;
}

/** Infer a GCS content-type from the file extension. */
function contentType(ext: string): string {
  switch (ext.toLowerCase()) {
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "webp":  return "image/webp";
    case "mp4":   return "video/mp4";
    default:      return "image/png";
  }
}

/**
 * Upload a Buffer to GCS and return the API-serving URL.
 *
 * @param buf    Raw file bytes.
 * @param subdir Folder inside the bucket, e.g. "covers", "pages", "characters".
 * @param ext    File extension without the dot (default "png").
 * @returns      A root-relative path: /api/images/<subdir>/<uuid>.<ext>
 */
export async function uploadImage(
  buf: Buffer,
  subdir: string,
  ext = "png",
): Promise<string> {
  const uuid = randomUUID();
  const objectPath = `story-images/${subdir}/${uuid}.${ext}`;

  const bucket = objectStorageClient.bucket(bucketId());
  const file = bucket.file(objectPath);
  await file.save(buf, {
    contentType: contentType(ext),
    resumable: false,
    metadata: { cacheControl: "public, max-age=31536000, immutable" },
  });

  logger.info({ objectPath }, "imageStorage: uploaded");
  return `/api/images/${subdir}/${uuid}.${ext}`;
}

/**
 * Stream a GCS object to an Express response.
 * Called by the /api/images/:subdir/:filename route.
 */
export async function streamImage(
  subdir: string,
  filename: string,
  res: any,
): Promise<void> {
  const objectPath = `story-images/${subdir}/${filename}`;

  const bucket = objectStorageClient.bucket(bucketId());
  const file = bucket.file(objectPath);

  const [exists] = await file.exists();
  if (!exists) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  const ext = filename.split(".").pop() ?? "png";
  res.setHeader("Content-Type", contentType(ext));
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  file.createReadStream()
    .on("error", (err: Error) => {
      logger.error({ err, objectPath }, "imageStorage: stream error");
      if (!res.headersSent) res.status(500).end();
    })
    .pipe(res);
}

/**
 * Fetch an image from a URL (works for both /api/images/... and legacy
 * /api/uploads/... paths — resolves against the local server port).
 */
export async function fetchImageBuffer(imageUrl: string): Promise<Buffer> {
  let url = imageUrl;
  if (imageUrl.startsWith("/")) {
    const port = process.env.PORT ?? "3000";
    url = `http://127.0.0.1:${port}${imageUrl}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchImageBuffer: ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Return true if this path/URL already points to GCS-backed storage
 * (i.e. it starts with /api/images/ or is a full https:// URL).
 * Legacy local paths (/api/uploads/...) return false.
 */
export function isStorageUrl(url: string): boolean {
  return url.startsWith("/api/images/") || url.startsWith("https://");
}
