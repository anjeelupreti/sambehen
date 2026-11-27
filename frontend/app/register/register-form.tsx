'use client';

import { useActionState } from 'react';
import Link from 'next/link';

import { FormAlert, PasswordField, SubmitButton, TextField } from '@/components/auth/fields';
import { formatMoney } from '@/lib/money';
import { registerPlayer, type RegisterState } from './actions';
import type { Invite } from './page';

const INITIAL: RegisterState = { error: null, fieldErrors: {}, success: false };

export function RegisterForm({ invite }: { invite: Invite | null }) {
  const [state, formAction] = useActionState(registerPlayer, INITIAL);

  if (state.success) {
    return (
      <div role="status" className="space-y-4">
        <h1 className="text-3xl font-extrabold tracking-[-0.01em] [font-stretch:118%]">
          Account created
        </h1>
        <p className="text-lp-dim leading-relaxed">
          Your store reviews every new account. Once they approve yours, you can sign in with the
          username and password you just chose.
        </p>
        <Link
          href="/login"
          className="bg-lp-primary hover:bg-lp-primary-hover focus-visible:outline-lp-primary inline-flex h-11 items-center rounded-lg px-6 font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-[-0.01em] [font-stretch:118%]">
        Create a player account
      </h1>

      {invite && (
        <div className="border-lp-line bg-lp-sunk mt-5 rounded-xl border px-4 py-3 text-sm">
          {invite.isValid ? (
            <>
              <p className="font-semibold">You’re invited</p>
              {Number(invite.refereeBonus) > 0 ? (
                <p className="text-lp-dim mt-0.5">
                  Get a {formatMoney(invite.refereeBonus)} bonus
                  {Number(invite.minQualifyingDebit) > 0
                    ? ` once you’ve deposited ${formatMoney(invite.minQualifyingDebit)}.`
                    : ' after your first deposit.'}
                </p>
              ) : (
                <p className="text-lp-dim mt-0.5">Your friend gets the credit when you join.</p>
              )}
            </>
          ) : (
            <p className="text-lp-dim">This invite link has expired. You can still sign up.</p>
          )}
        </div>
      )}

      <form action={formAction} className="mt-8 space-y-5" noValidate>
        {state.error && <FormAlert>{state.error}</FormAlert>}
        {invite?.isValid && <input type="hidden" name="referralCode" value={invite.code} />}

        <TextField
          id="fullName"
          label="Full name"
          optional
          autoComplete="name"
          error={state.fieldErrors.fullName}
        />
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          error={state.fieldErrors.email}
        />
        <TextField
          id="username"
          label="Username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          error={state.fieldErrors.username}
        />
        <TextField
          id="phone"
          label="Phone"
          type="tel"
          optional
          autoComplete="tel"
          error={state.fieldErrors.phone}
        />
        <PasswordField
          id="password"
          label="Password"
          autoComplete="new-password"
          required
          hint="At least 8 characters."
          error={state.fieldErrors.password}
        />

        <p className="text-lp-dim text-xs leading-relaxed">
          By creating an account, you agree to the{' '}
          <Link href="/legal/terms" className="text-lp-text underline underline-offset-2">
            Terms of service
          </Link>{' '}
          and{' '}
          <Link href="/legal/privacy" className="text-lp-text underline underline-offset-2">
            Privacy policy
          </Link>
          .
        </p>

        <SubmitButton label="Create account" pendingLabel="Creating account…" />
      </form>

      <p className="text-lp-dim mt-8 text-sm">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-lp-primary focus-visible:outline-lp-primary rounded font-medium hover:underline focus-visible:outline-2"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
