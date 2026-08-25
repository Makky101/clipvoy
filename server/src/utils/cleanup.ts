import fs from "node:fs/promises";

export async function deleteFileIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      console.warn(`Failed to delete temporary file: ${filePath}`);
    }
  }
}

/**
 * TODO (production): uploaded videos and generated clips should not live on
 * local disk indefinitely. Use object storage and a scheduled job to expire
 * files after a TTL (for example 24 hours).
 */
export async function cleanupUpload(filePath: string | undefined): Promise<void> {
  if (!filePath) {
    return;
  }
  await deleteFileIfExists(filePath);
}
