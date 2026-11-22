'use client';

import { useActionState, useState } from 'react';

import { FormAlert, PasswordField, SubmitButton, TextField } from '@/components/auth/fields';
import { login, type LoginState } from './actions';

const INITIAL: LoginState = { error: null, fieldErrors: {} };

export function LoginForm({ from }: { from: string }) {
  const [state, formAction] = useActionState(login, INITIAL);
  const [showHelp, setShowHelp] = useState(false);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && <FormAlert>{state.error}</FormAlert>}

      <input type="hidden" name="from" value={from} />

      <TextField
        id="identifier"
        label="Username or email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus
        required
        error={state.fieldErrors.identifier}
      />

      <div className="space-y-3">
        <PasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          required
          error={state.fieldErrors.password}
          aside={
            <button
              type="button"
              onClick={() => setShowHelp((current) => !current)}
              aria-expanded={showHelp}
              aria-controls="password-help"
              className="text-lp-primary focus-visible:outline-lp-primary rounded text-sm font-medium hover:underline focus-visible:outline-2"
            >
              Forgot password?
            </button>
          }
        />
        {showHelp && (
          <p id="password-help" className="bg-lp-sunk text-lp-dim rounded-lg px-4 py-3 text-sm">
            Passwords are reset by the people who manage your account. Staff should ask their
            manager; players should message or visit their store.
          </p>
        )}
      </div>

      <SubmitButton label="Sign in" pendingLabel="Signing in…" />
    </form>
  );
}
