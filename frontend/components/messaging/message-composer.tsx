'use client';

import { useRef, useState } from 'react';
import { Loader2Icon, PaperclipIcon, SendIcon } from 'lucide-react';

import { AttachmentChips } from '@/components/messaging/attachment-chips';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAttachmentUpload } from '@/hooks/use-attachment-upload';
import type { MessageAttachment } from '@/lib/types';

const ACCEPT =
  'image/png,image/jpeg,image/webp,image/gif,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip';

/**
 * The input row shared by every messaging surface — full page, the floating
 * bubble, and the customer portal thread. One implementation rather than
 * three, so "can you attach a file here too" never again means finding and
 * updating three separate forms.
 *
 * Files upload as soon as they're picked (see useAttachmentUpload); by the
 * time send is pressed the attachments already have URLs, so send is just
 * the text plus a list of references, not a wait on file I/O.
 */
export function MessageComposer({
  uploadUrl,
  onSend,
  sending,
  placeholder = 'Type a message…',
  autoFocus,
}: {
  uploadUrl: string;
  /** Return true to clear the composer; false leaves the draft in place (e.g. after a failure). */
  onSend: (body: string, attachments: MessageAttachment[]) => Promise<boolean>;
  sending: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const { pending, addFiles, remove, clear, ready, uploading } = useAttachmentUpload(uploadUrl);
  const fileInput = useRef<HTMLInputElement>(null);

  const canSend = (draft.trim().length > 0 || ready.length > 0) && !uploading && !sending;

  const submit = async () => {
    if (!canSend) return;
    const ok = await onSend(draft.trim(), ready);
    if (ok) {
      setDraft('');
      clear();
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="border-t">
      <AttachmentChips pending={pending} onRemove={remove} />

      <form
        className="flex items-center gap-1.5 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => {
            if (event.target.files?.length) addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label="Attach files"
          disabled={sending}
          onClick={() => fileInput.current?.click()}
        >
          <PaperclipIcon className="size-4" />
        </Button>

        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          aria-label="Message"
          disabled={sending}
          autoFocus={autoFocus}
        />

        <Button type="submit" size="icon" className="shrink-0" disabled={!canSend}>
          {sending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <SendIcon className="size-4" />
          )}
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
