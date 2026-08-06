'use client';

import { useState } from 'react';
import { MegaphoneIcon } from 'lucide-react';

import {
  createCampaign,
  sendCampaign,
  type EmailKind,
  type RecipientFilter,
} from '@/app/(app)/broadcast/actions';
import { AudienceBuilder } from '@/components/broadcast/audience-builder';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormModal } from '@/components/forms/form-modal';
import { SelectField, TextField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAction } from '@/hooks/use-action';
import { formatCount } from '@/lib/money';
import type { components } from '@/lib/api-schema';

type RecipientPreview = components['schemas']['RecipientPreviewDto'];

/**
 * The email kind is not cosmetic.
 *
 * It decides the layout, the accent colour, and — importantly — whether an
 * unsubscribe footer appears. Transactional mail carries none because it is
 * account and security correspondence a customer cannot opt out of; a
 * promotion sent under that kind would be a compliance problem, not a
 * styling choice.
 */
const EMAIL_KINDS: { value: EmailKind; label: string }[] = [
  { value: 'promotional', label: 'Promotional — offers (unsubscribable)' },
  { value: 'informational', label: 'Informational — notices (unsubscribable)' },
  { value: 'notification', label: 'Notification — something happened on the account' },
  { value: 'transactional', label: 'Transactional — account and security (never unsubscribable)' },
  { value: 'alert', label: 'Alert — needs attention' },
];

/**
 * Compose a broadcast and send it to a counted audience.
 *
 * Two steps in one modal, in the order the decision is actually made: write
 * the message, then choose and *verify* who receives it. Sending stays
 * disabled until the audience has been counted against live data, because
 * an email cannot be recalled and a wrong filter is invisible until it is
 * too late.
 */
export function ComposeBroadcastModal() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [emailKind, setEmailKind] = useState<EmailKind>('promotional');
  const [filter, setFilter] = useState<RecipientFilter>({});
  const [preview, setPreview] = useState<RecipientPreview | null>(null);

  const create = useAction(createCampaign);
  const send = useAction(sendCampaign);

  const sendable = preview ? preview.totalRecipients - preview.excluded : 0;
  const ready = subject.trim().length > 0 && bodyText.trim().length > 0 && sendable > 0;

  const reset = () => {
    setSubject('');
    setBodyText('');
    setEmailKind('promotional');
    setFilter({});
    setPreview(null);
  };

  const doSend = async () => {
    // Created and sent in one go: the draft exists only to be delivered, so
    // a failure at the send step leaves a draft on the campaigns list rather
    // than losing the message entirely.
    const draft = await create.run({
      subject: subject.trim(),
      bodyText: bodyText.trim(),
      emailKind,
    });
    if (!draft.ok || !draft.data) return { ok: false };

    const result = await send.run(draft.data.id, filter);
    if (result.ok) {
      setOpen(false);
      reset();
    }
    return { ok: result.ok };
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <MegaphoneIcon className="size-4" />
        New broadcast
      </Button>

      <FormModal
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        title="New broadcast"
        description="Customers receive this by email. Choose the audience below and preview it — an email cannot be recalled once queued."
        submitLabel={ready ? `Send to ${formatCount(sendable)}` : 'Send'}
        pending={create.pending || send.pending}
        onSubmit={() => {
          if (ready) setConfirming(true);
        }}
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
      >
        <TextField
          name="subject"
          label="Subject"
          required
          autoFocus
          maxLength={200}
          value={subject}
          onChange={setSubject}
          error={create.fieldErrors.subject}
        />

        <SelectField
          name="emailKind"
          label="Kind"
          required
          value={emailKind}
          onChange={(v) => setEmailKind(v as EmailKind)}
          options={EMAIL_KINDS}
          error={create.fieldErrors.emailKind}
          hint="Decides the layout and whether an unsubscribe footer appears."
        />

        <div className="grid gap-1.5">
          <Label htmlFor="bodyText">
            Message
            <span className="text-muted-foreground" aria-hidden>
              *
            </span>
          </Label>
          <textarea
            id="bodyText"
            value={bodyText}
            onChange={(event) => setBodyText(event.target.value)}
            rows={7}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            placeholder="Write the message customers will receive…"
            aria-invalid={Boolean(create.fieldErrors.bodyText)}
          />
          {create.fieldErrors.bodyText ? (
            <p className="text-destructive text-xs">{create.fieldErrors.bodyText}</p>
          ) : null}
        </div>

        <div className="border-t pt-4">
          <AudienceBuilder
            filter={filter}
            onChange={setFilter}
            preview={preview}
            onPreview={setPreview}
          />
        </div>

        {!ready ? (
          <p className="text-muted-foreground text-xs">
            Write a subject and message, then preview the audience to enable sending.
          </p>
        ) : null}
      </FormModal>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Send to ${formatCount(sendable)} customers?`}
        description="This queues the email for delivery immediately. It cannot be recalled once sending starts."
        confirmLabel="Send broadcast"
        onConfirm={doSend}
      />
    </>
  );
}
