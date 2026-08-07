'use client';

import { useCallback, useState } from 'react';

import type { MessageAttachment } from '@/lib/types';

export interface PendingAttachment {
  id: string;
  file: File;
  /** Created once per file rather than per render, so it can be revoked exactly once too. */
  previewUrl: string | null;
  status: 'uploading' | 'done' | 'error';
  attachment?: MessageAttachment;
  error?: string;
}

/**
 * Picks, uploads and tracks files for a message before it is sent.
 *
 * Files upload the moment they are picked, not on send — so by the time
 * someone hits send, the attachments already have URLs and the message
 * itself is a fast JSON post rather than something waiting on file I/O.
 * Multiple files upload in parallel, each tracked independently, so one
 * slow or failed upload does not block the others.
 *
 * `uploadUrl` differs by realm (staff vs customer) because middleware
 * gates each on a different session cookie — see the two route handlers
 * under app/api/messages/attachments and app/customer/messages/attachments.
 */
export function useAttachmentUpload(uploadUrl: string) {
  const [pending, setPending] = useState<PendingAttachment[]>([]);

  const upload = useCallback(
    async (item: PendingAttachment) => {
      try {
        const formData = new FormData();
        formData.append('file', item.file);
        const response = await fetch(uploadUrl, { method: 'POST', body: formData });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? 'Upload failed.');
        }

        const attachment = (await response.json()) as MessageAttachment;
        setPending((current) =>
          current.map((p) => (p.id === item.id ? { ...p, status: 'done', attachment } : p)),
        );
      } catch (error) {
        setPending((current) =>
          current.map((p) =>
            p.id === item.id
              ? {
                  ...p,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Upload failed.',
                }
              : p,
          ),
        );
      }
    },
    [uploadUrl],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const items: PendingAttachment[] = Array.from(files).map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        status: 'uploading',
      }));

      setPending((current) => [...current, ...items]);
      for (const item of items) void upload(item);
    },
    [upload],
  );

  const remove = useCallback((id: string) => {
    setPending((current) => {
      const target = current.find((p) => p.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((p) => p.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    setPending((current) => {
      for (const p of current) if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      return [];
    });
  }, []);

  const ready = pending
    .filter((p) => p.status === 'done' && p.attachment)
    .map((p) => p.attachment!);
  const uploading = pending.some((p) => p.status === 'uploading');

  return { pending, addFiles, remove, clear, ready, uploading };
}
