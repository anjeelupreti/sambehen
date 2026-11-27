import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
import { getCustomerAccessToken } from '@/lib/customer-session';
import { getAccessToken } from '@/lib/session';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'Create a player account' };

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const API_PREFIX = process.env.API_PREFIX ?? '/api/v1';

export interface Invite {
  code: string;
  refereeBonus: string;
  minQualifyingDebit: string;
  isValid: boolean;
}

async function lookUpInvite(ref: string): Promise<Invite | null> {
  try {
    const response = await fetch(
      `${API_URL}${API_PREFIX}/public/referral/${encodeURIComponent(ref)}`,
      { cache: 'no-store' },
    );
    return response.ok ? ((await response.json()) as { data: Invite }).data : null;
  } catch {
    return null;
  }
}

/**
 * Player self-registration. The account waits for a store's approval.
 * Arriving from an invite link (?ref=), the invite rides along with the
 * form so the friend who shared it is credited.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getAccessToken()) redirect('/dashboard');
  if (await getCustomerAccessToken()) redirect('/customer');

  const params = await searchParams;
  const ref = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  const invite = ref ? await lookUpInvite(ref) : null;

  return (
    <AuthShell mascot={invite?.isValid ? 'friends' : 'door'}>
      <RegisterForm invite={invite} />
    </AuthShell>
  );
}
