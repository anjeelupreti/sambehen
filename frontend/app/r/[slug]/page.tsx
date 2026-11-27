import { notFound, redirect } from 'next/navigation';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const API_PREFIX = process.env.API_PREFIX ?? '/api/v1';

/**
 * Where an invite link lands: straight on sign-up with the invite
 * attached, so the friend who shared it gets the credit.
 */
export default async function ReferralLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let code: string | null = null;
  let missing = false;
  try {
    const response = await fetch(
      `${API_URL}${API_PREFIX}/public/referral/${encodeURIComponent(slug)}`,
      { cache: 'no-store' },
    );
    if (response.status === 404) missing = true;
    else if (response.ok) code = ((await response.json()) as { data: { code: string } }).data.code;
  } catch {
    // The sign-up page looks the invite up again and copes without it.
  }

  if (missing) notFound();
  redirect(`/register?ref=${encodeURIComponent(code ?? slug)}`);
}
