'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircleIcon, ArrowRightIcon, CheckCircle2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registerCustomer, type CustomerRegisterState } from './actions';

const INITIAL: CustomerRegisterState = { error: null, fieldErrors: {}, success: false };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className="w-full font-semibold h-11 flex items-center justify-center gap-2 group"
      disabled={pending}
    >
      {pending ? 'Submitting…' : 'Create account'}
      {!pending && (
        <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      )}
    </Button>
  );
}

export function CustomerRegisterForm() {
  const [state, formAction] = useActionState(registerCustomer, INITIAL);

  if (state.success) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-6 text-center"
      >
        <CheckCircle2Icon className="size-8 text-emerald-500" />
        <p className="font-semibold">Account created</p>
        <p className="text-muted-foreground text-sm">
          A team member will review and approve your account shortly. You&apos;ll be able to sign in
          once that happens.
        </p>
        <a href="/customer/login" className="text-primary text-sm font-medium hover:underline">
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <div
          role="alert"
          className="bg-destructive/10 border-destructive/20 text-red-500 flex items-start gap-2 rounded-lg border p-4 text-sm font-medium"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="you@example.com"
          aria-invalid={Boolean(state.fieldErrors.email)}
          aria-describedby={state.fieldErrors.email ? 'email-error' : undefined}
        />
        {state.fieldErrors.email ? (
          <p id="email-error" className="text-red-500 text-sm font-medium">
            {state.fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          required
          placeholder="yourname"
          aria-invalid={Boolean(state.fieldErrors.username)}
          aria-describedby={state.fieldErrors.username ? 'username-error' : undefined}
        />
        {state.fieldErrors.username ? (
          <p id="username-error" className="text-red-500 text-sm font-medium">
            {state.fieldErrors.username}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">Full name (optional)</Label>
        <Input id="fullName" name="fullName" autoComplete="name" placeholder="Jordan Lee" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" name="phone" autoComplete="tel" placeholder="+1 555 010 0100" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          placeholder="At least 8 characters"
          aria-invalid={Boolean(state.fieldErrors.password)}
          aria-describedby={state.fieldErrors.password ? 'password-error' : undefined}
        />
        {state.fieldErrors.password ? (
          <p id="password-error" className="text-red-500 text-sm font-medium">
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>

      <div className="pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}
