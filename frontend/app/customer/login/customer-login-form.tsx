'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircleIcon, ArrowRightIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { customerLogin, type CustomerLoginState } from './actions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const INITIAL: CustomerLoginState = { error: null, fieldErrors: {} };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className="w-full font-semibold h-11 flex items-center justify-center gap-2 group"
      disabled={pending}
    >
      {pending ? 'Signing in…' : 'Access Your Account'}
      {!pending && (
        <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      )}
    </Button>
  );
}

export function CustomerLoginForm() {
  const [state, formAction] = useActionState(customerLogin, INITIAL);

  return (
    <form action={formAction} className="space-y-6">
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
        <Label htmlFor="identifier">Username or email</Label>
        <Input
          id="identifier"
          name="identifier"
          autoComplete="username"
          autoFocus
          required
          placeholder="customer@example.com"
          aria-invalid={Boolean(state.fieldErrors.identifier)}
          aria-describedby={state.fieldErrors.identifier ? 'identifier-error' : undefined}
        />
        {state.fieldErrors.identifier ? (
          <p id="identifier-error" className="text-red-500 text-sm font-medium">
            {state.fieldErrors.identifier}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>

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
                <DialogTitle>Need help signing in?</DialogTitle>
                <DialogDescription>
                  Self-service password resets are unavailable for customer accounts to protect your
                  security.
                  <br />
                  <br />
                  Please contact our support team or your assigned agent to request a secure
                  password reset.
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
