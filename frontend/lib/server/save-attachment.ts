import 'server-only';

import { randomUUID } from 'crypto';
import { storeFile } from './storage';

/**
 * Shared by both message-attachment upload routes (staff and customer —
 * two routes because middleware gates them on different session cookies,
 * one implementation because the validation and disk write are identical).
 *
 * Same reasoning as the game cover fix: the extension comes from a
 * validated MIME type, never the client's filename, so a file cannot land
 * on disk as something it claims not to be.
 */
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'application/zip': 'zip',
};

const MAX_BYTES = 15 * 1024 * 1024;

export interface SavedAttachment {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export type SaveAttachmentResult =
  { ok: true; attachment: SavedAttachment } | { ok: false; status: number; message: string };

export async function saveAttachment(file: File): Promise<SaveAttachmentResult> {
  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return {
      ok: false,
      status: 400,
      message: 'That file type is not supported.',
    };
  }

  if (file.size > MAX_BYTES) {
    return { ok: false, status: 400, message: 'Files must be 15MB or smaller.' };
  }

  let url: string;
  try {
    url = await storeFile({
      key: `attachments/${randomUUID()}.${extension}`,
      body: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
      // Images display inline in the thread; everything else downloads.
      download: !file.type.startsWith('image/'),
    });
  } catch (error) {
    console.error('Error storing attachment:', error);
    return { ok: false, status: 502, message: 'The file could not be stored. Try again.' };
  }

  return {
    ok: true,
    attachment: {
      url,
      // The original name is what a recipient recognises — kept as
      // metadata, never as the path on disk.
      filename: file.name.slice(0, 255),
      mimeType: file.type,
      size: file.size,
    },
  };
}
