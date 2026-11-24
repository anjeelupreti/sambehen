'use client';

import { useActionState } from 'react';
import { CheckCircle2Icon } from 'lucide-react';

import { requestDemo, type ContactState } from './actions';
import { cn } from '@/lib/utils';

const input =
  'border-lp-line-strong bg-lp-raised focus-visible:border-lp-primary focus-visible:ring-lp-primary/25 w-full rounded-lg border px-3.5 py-3 text-base outline-none focus-visible:ring-4 aria-invalid:border-lp-stop';

export function ContactForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(requestDemo, {
    status: 'idle',
  });

  if (state.status === 'sent') {
    return (
      <div role="status" className="border-lp-line bg-lp-raised rounded-2xl border p-8">
        <CheckCircle2Icon className="text-lp-ok size-8" aria-hidden />
        <h2 className="mt-4 text-2xl font-extrabold [font-stretch:112%]">Request sent</h2>
        <p className="text-lp-dim mt-2 leading-relaxed">
          We’ll reply to the email address you gave us to set up a time.
        </p>
      </div>
    );
  }

  const error = (key: string) => state.fieldErrors?.[key];

  return (
    <form
      action={action}
      noValidate
      className="border-lp-line bg-lp-raised space-y-5 rounded-2xl border p-6 sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" name="name" error={error('name')}>
          <input
            id="name"
            name="name"
            autoComplete="name"
            required
            className={input}
            aria-invalid={!!error('name')}
            aria-describedby={error('name') ? 'name-error' : undefined}
          />
        </Field>
        <Field label="Work email" name="email" error={error('email')}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={input}
            aria-invalid={!!error('email')}
            aria-describedby={error('email') ? 'email-error' : undefined}
          />
        </Field>
        <Field label="Company" name="company" error={error('company')}>
          <input
            id="company"
            name="company"
            autoComplete="organization"
            required
            className={input}
            aria-invalid={!!error('company')}
            aria-describedby={error('company') ? 'company-error' : undefined}
          />
        </Field>
        <Field label="Number of stores" name="stores" optional error={error('stores')}>
          <input
            id="stores"
            name="stores"
            inputMode="numeric"
            className={input}
            aria-invalid={!!error('stores')}
            aria-describedby={error('stores') ? 'stores-error' : undefined}
          />
        </Field>
      </div>
      <Field label="Anything we should know" name="message" optional>
        <textarea id="message" name="message" rows={4} className={cn(input, 'resize-y')} />
      </Field>
      {/* Left empty by people; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px]">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {state.message && (
        <p role="alert" className="text-lp-stop text-sm">
          {state.message}{' '}
          <a href={`mailto:${email}`} className="underline">
            {email}
          </a>
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-lp-primary hover:bg-lp-primary-hover focus-visible:outline-lp-primary inline-flex h-12 items-center rounded-lg px-6 font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Book a demo'}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  optional,
  error,
  children,
}: {
  label: string;
  name: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-semibold">
        {label}
        {optional && <span className="text-lp-dim font-normal"> (optional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${name}-error`} className="text-lp-stop mt-1.5 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
