import 'server-only';

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Where uploaded files (game covers, message attachments) are stored.
 *
 * Cloudflare R2 when the R2_* variables are set, which a deployment needs:
 * Vercel's filesystem is read-only, and in production Next.js serves only
 * the `public/` files that existed at build time, so a file written there
 * at runtime is never reachable. Without R2 configured, files fall back to
 * `public/uploads` so local development needs no extra setup.
 *
 * Callers pass a key they built from a random id and a validated
 * extension, never a client-supplied filename.
 */

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

function readR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) return null;
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicUrl: publicUrl.replace(/\/+$/, ''),
  };
}

let client: S3Client | null = null;

function r2Client(config: R2Config): S3Client {
  client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return client;
}

export interface StoreFileInput {
  /** Path inside the bucket (or under public/uploads), e.g. `games/<uuid>.png`. */
  key: string;
  body: Buffer;
  contentType: string;
  /**
   * Serve with `Content-Disposition: attachment` so the browser downloads
   * the file instead of rendering it. Used for non-image attachments.
   */
  download?: boolean;
}

/** Stores a file and returns the URL it can be fetched from. */
export async function storeFile({
  key,
  body,
  contentType,
  download,
}: StoreFileInput): Promise<string> {
  const config = readR2Config();

  if (config) {
    await r2Client(config).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentDisposition: download ? 'attachment' : undefined,
        // Keys are random and never overwritten, so the file can be cached forever.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return `${config.publicUrl}/${key}`;
  }

  const path = join(process.cwd(), 'public', 'uploads', ...key.split('/'));
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, body);
  return `/uploads/${key}`;
}
