'use client';

import { useCallback, useState } from 'react';

import type { MessageAttachment } from '@/lib/types';

export interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string | null;
  status: 'uploading' | 'done' | 'error';
  /** 0–1 while uploading. */
  progress: number;
  attachment?: MessageAttachment;
  error?: string;
}

/**
 * Uploads files as soon as they are added, so the message can go the
 * moment the person presses send. XMLHttpRequest rather than fetch, because
 * only it reports upload progress.
 */
export function useAttachmentUpload(uploadUrl: string) {
  const [pending, setPending] = useState<PendingAttachment[]>([]);

  const patch = useCallback((id: string, change: Partial<PendingAttachment>) => {
    setPending((current) => current.map((p) => (p.id === id ? { ...p, ...change } : p)));
  }, []);

  const upload = useCallback(
    (item: PendingAttachment) => {
      const request = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', item.file);

      request.upload.onprogress = (event) => {
        if (event.lengthComputable) patch(item.id, { progress: event.loaded / event.total });
      };
      request.onload = () => {
        let payload: (MessageAttachment & { error?: string }) | null = null;
        try {
          payload = JSON.parse(request.responseText);
        } catch {
          payload = null;
        }
        if (request.status >= 200 && request.status < 300 && payload) {
          patch(item.id, { status: 'done', progress: 1, attachment: payload });
        } else {
          patch(item.id, {
            status: 'error',
            error: payload?.error ?? 'Upload failed. Remove it and try again.',
          });
        }
      };
      request.onerror = () =>
        patch(item.id, {
          status: 'error',
          error: 'Upload failed. Check your connection and try again.',
        });

      request.open('POST', uploadUrl);
      request.send(formData);
    },
    [uploadUrl, patch],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const items: PendingAttachment[] = Array.from(files).map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        status: 'uploading',
        progress: 0,
      }));

      setPending((current) => [...current, ...items]);
      for (const item of items) upload(item);
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
    .map((p) => p.attachment!) as MessageAttachment[];
  const uploading = pending.some((p) => p.status === 'uploading');

  return { pending, addFiles, remove, clear, ready, uploading };
}

export type AttachmentUpload = ReturnType<typeof useAttachmentUpload>;
