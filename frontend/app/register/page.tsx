import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
import { getCustomerAccessToken } from '@/lib/customer-session';
import { getAccessToken } from '@/lib/session';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'Create a player account' };

/** Player self-registration. The account waits for a store's approval. */
export default async function RegisterPage() {
  if (await getAccessToken()) redirect('/dashboard');
  if (await getCustomerAccessToken()) redirect('/customer');

  return (
    <AuthShell mascot="door">
      <RegisterForm />
    </AuthShell>
  );
}
