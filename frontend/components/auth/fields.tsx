'use client';

import { useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import { cn } from '@/lib/utils';

const INPUT =
  'border-lp-line-strong bg-lp-raised text-lp-text placeholder:text-lp-dim/70 h-11 w-full rounded-lg border px-3.5 text-[15px] transition-colors outline-none focus:border-lp-primary focus:ring-3 focus:ring-lp-primary/15 aria-invalid:border-lp-stop aria-invalid:ring-lp-stop/10';

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  /** Rendered at the right of the label row, e.g. a help toggle. */
  aside?: ReactNode;
  children: (describedBy: string | undefined) => ReactNode;
}

function Field({ id, label, error, hint, optional, aside, children }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {optional && <span className="text-lp-dim font-normal"> (optional)</span>}
        </label>
        {aside}
      </div>
      {children(describedBy)}
      {error ? (
        <p id={`${id}-error`} className="text-lp-stop text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-lp-dim text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  id,
  label,
  error,
  hint,
  optional,
  aside,
  ...input
}: Omit<FieldProps, 'children'> & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field id={id} label={label} error={error} hint={hint} optional={optional} aside={aside}>
      {(describedBy) => (
        <input
          id={id}
          name={id}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={INPUT}
          {...input}
        />
      )}
    </Field>
  );
}

export function PasswordField({
  id,
  label,
  error,
  hint,
  aside,
  ...input
}: Omit<FieldProps, 'children' | 'optional'> & React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <Field id={id} label={label} error={error} hint={hint} aside={aside}>
      {(describedBy) => (
        <div className="relative">
          <input
            id={id}
            name={id}
            type={visible ? 'text' : 'password'}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy}
            className={cn(INPUT, 'pr-16')}
            {...input}
          />
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-controls={id}
            aria-pressed={visible}
            className="text-lp-dim hover:text-lp-text focus-visible:outline-lp-primary absolute inset-y-0 right-1.5 my-1.5 rounded-md px-2.5 text-xs font-semibold focus-visible:outline-2"
          >
            {visible ? 'Hide' : 'Show'}
          </button>
        </div>
      )}
    </Field>
  );
}

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="border-lp-stop/25 bg-lp-stop/[0.06] text-lp-stop rounded-lg border px-4 py-3 text-sm"
    >
      {children}
    </div>
  );
}

export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-lp-primary hover:bg-lp-primary-hover focus-visible:outline-lp-primary h-11 w-full rounded-lg font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-progress disabled:opacity-70"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
