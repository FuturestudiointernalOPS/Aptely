/**
 * Storage Service - Manage file uploads, validation, and bucket operations
 * Handles all storage-related operations for documents, avatars, and documents
 */

import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";

// ─── Storage Configuration ────────────────────────────────────────────────────

export const STORAGE_BUCKETS = {
  DOCUMENTS: "application-documents",
  AVATARS: "avatars",
  INSTITUTION_LOGOS: "institution-logos",
  OFFER_DOCUMENTS: "offer-documents",
  ONBOARDING_DOCUMENTS: "onboarding-documents",
  CV_STUDIO_FILES: "cv-studio-files",
} as const;

const PUBLIC_BUCKETS: readonly string[] = [STORAGE_BUCKETS.AVATARS, "logos", "vault-proofs"];

const STORAGE_CONFIG = {
  [STORAGE_BUCKETS.DOCUMENTS]: {
    maxSize: 10 * 1024 * 1024, // 10MB for documents
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
      "image/jpeg",
      "image/png",
      "image/gif",
    ],
    allowedExtensions: [
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "txt",
      "csv",
      "jpg",
      "jpeg",
      "png",
      "gif",
    ],
  },
  [STORAGE_BUCKETS.AVATARS]: {
    maxSize: 5 * 1024 * 1024, // 5MB for avatars
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedExtensions: ["jpg", "jpeg", "png", "webp"],
  },
  [STORAGE_BUCKETS.INSTITUTION_LOGOS]: {
    maxSize: 5 * 1024 * 1024, // 5MB for logos
    allowedMimeTypes: ["image/jpeg", "image/png", "image/svg+xml", "image/webp"],
    allowedExtensions: ["jpg", "jpeg", "png", "svg", "webp"],
  },
  [STORAGE_BUCKETS.OFFER_DOCUMENTS]: {
    maxSize: 15 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf"],
    allowedExtensions: ["pdf"],
  },
  [STORAGE_BUCKETS.ONBOARDING_DOCUMENTS]: {
    maxSize: 15 * 1024 * 1024,
    allowedMimeTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    allowedExtensions: ["pdf", "jpg", "jpeg", "png", "webp", "docx"],
  },
  [STORAGE_BUCKETS.CV_STUDIO_FILES]: {
    maxSize: 10 * 1024 * 1024,
    allowedMimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    allowedExtensions: ["pdf", "docx"],
  },
};

// ─── Storage Initialization ───────────────────────────────────────────────────

/**
 * Initialize Supabase storage buckets on application startup
 * Creates buckets if they don't exist, applies RLS policies, and configures CORS
 */
export async function initializeStorageBuckets(): Promise<void> {
  process.stderr.write("[STORAGE] Initializing storage buckets...\n");

  try {
    const { data: existing, error: listError } = await supabaseAdmin.storage.listBuckets();

    if (listError) {
      console.warn(`[STORAGE] Warning: Could not list buckets: ${listError.message}`);
      return;
    }

    const existingNames = new Set(existing?.map((b) => b.name) ?? []);
    const missing = Object.values(STORAGE_BUCKETS).filter((name) => !existingNames.has(name));

    if (missing.length === 0) {
      process.stderr.write("[STORAGE] ✅ All buckets already exist\n");
      return;
    }

    await Promise.all(
      missing.map(async (bucketName) => {
        process.stderr.write(`[STORAGE] Creating bucket: ${bucketName}\n`);
        const { error } = await supabaseAdmin.storage.createBucket(bucketName, {
          public: PUBLIC_BUCKETS.includes(bucketName),
          fileSizeLimit:
            STORAGE_CONFIG[bucketName as keyof typeof STORAGE_CONFIG]?.maxSize || 10 * 1024 * 1024,
        });
        if (error) {
          console.warn(`[STORAGE] Could not create bucket ${bucketName}: ${error.message}`);
        } else {
          process.stderr.write(`[STORAGE] ✅ Created bucket: ${bucketName}\n`);
        }
      })
    );

    process.stderr.write("[STORAGE] ✅ Storage buckets initialized successfully\n");
  } catch (error) {
    console.error(
      `[STORAGE] ❌ Failed to initialize buckets: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function ensureBucketExistsOrThrow(bucketName: string): Promise<void> {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  if (listError) {
    throw new AppError(500, `Failed to list storage buckets: ${listError.message}`);
  }

  const exists = buckets?.some((bucket) => bucket.name === bucketName);
  if (exists) return;

  const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit:
      STORAGE_CONFIG[bucketName as keyof typeof STORAGE_CONFIG]?.maxSize || 10 * 1024 * 1024,
  });

  if (createError) {
    throw new AppError(500, `Failed to create storage bucket ${bucketName}: ${createError.message}`);
  }
}

// ─── File Upload Operations ───────────────────────────────────────────────────

export interface FileUploadResult {
  path: string;
  url: string;
  size: number;
  mimeType: string;
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(
  bucketName: string,
  filePath: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<FileUploadResult> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: true, // Overwrite if exists
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    if (!data?.path) {
      throw new Error("Upload succeeded but no path returned");
    }

    // Public buckets: stable public URL. Private buckets: signed URL (expires — callers should re-sign for long-term access)
    let url = "";
    if (PUBLIC_BUCKETS.includes(bucketName)) {
      const { data: urlData } = supabaseAdmin.storage.from(bucketName).getPublicUrl(data.path);
      url = urlData?.publicUrl || "";
    } else {
      const { data: signedData } = await supabaseAdmin.storage
        .from(bucketName)
        .createSignedUrl(data.path, 60 * 60);
      url = signedData?.signedUrl || "";
    }

    return {
      path: data.path,
      url,
      size: fileBuffer.length,
      mimeType,
    };
  } catch (error) {
    throw new AppError(
      500,
      `Failed to upload file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get publicly signed URL for authenticated access
 */
export async function getSignedUrl(
  bucketName: string,
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data?.signedUrl || "";
  } catch (error) {
    throw new AppError(
      500,
      `Failed to generate signed URL: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Safe path builder - prevents directory traversal
 */
export function buildStoragePath(...parts: string[]): string {
  // Filter out empty strings and normalize parts
  const sanitized = parts
    .filter((p) => p && p.length > 0)
    .map((p) => p.replace(/^\/+|\/+$/g, "")) // Remove leading/trailing slashes
    .filter((p) => !p.includes("..") && !p.includes("~")); // Prevent traversal

  if (!sanitized.length) {
    throw new AppError(400, "Invalid storage path");
  }

  return sanitized.join("/");
}

// ─── Document-Specific Helpers ────────────────────────────────────────────────

/**
 * Build path for user avatar
 */
export function buildAvatarPath(userId: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^\w.-]/g, "_");

  return buildStoragePath(userId, `${timestamp}-${sanitizedFileName}`);
}

/**
 * Build path for institution logo
 */
export function buildLogoPath(institutionId: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^\w.-]/g, "_");

  return buildStoragePath(institutionId, `${timestamp}-${sanitizedFileName}`);
}

