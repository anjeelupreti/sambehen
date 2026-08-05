'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircleIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login, type LoginState } from './actions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const INITIAL: LoginState = { error: null, fieldErrors: {} };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full font-semibold" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in to Dashboard'}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(login, INITIAL);

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <div
          role="alert"
          className="bg-destructive/10 border-destructive/20 text-red-400 flex items-start gap-2 rounded-lg border p-3 text-sm font-medium"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="identifier">Username or email</Label>
        <Input
          id="identifier"
          name="identifier"
          autoComplete="username"
          autoFocus
          required
          placeholder="admin@sambehen.com"
          aria-invalid={Boolean(state.fieldErrors.identifier)}
          aria-describedby={state.fieldErrors.identifier ? 'identifier-error' : undefined}
        />
        {state.fieldErrors.identifier ? (
          <p id="identifier-error" className="text-red-400 text-sm font-medium">
            {state.fieldErrors.identifier}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>

          {/* Forgot Password Dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="text-sm font-medium text-primary hover:underline transition-colors"
              >
                Forgot password?
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Reset your password</DialogTitle>
                <DialogDescription>
                  For security reasons, self-service password resets are disabled.
                  <br />
                  <br />
                  Please contact your <strong>Manager</strong> or the{' '}
                  <strong>System Administrator</strong> to request a new password. They can generate
                  a secure one-time password for you from the staff dashboard.
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          aria-invalid={Boolean(state.fieldErrors.password)}
          aria-describedby={state.fieldErrors.password ? 'password-error' : undefined}
        />
        {state.fieldErrors.password ? (
          <p id="password-error" className="text-destructive text-sm font-medium">
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}
