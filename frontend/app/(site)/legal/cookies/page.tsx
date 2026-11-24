import type { Metadata } from 'next';

import { LegalPage } from '@/components/landing/prose';
import { COMPANY } from '@/components/landing/site-shell';

export const metadata: Metadata = { title: 'Cookie notice' };

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie notice"
      summary={`${COMPANY.product} only uses the cookies it needs to keep you signed in.`}
    >
      <h2>Cookies we set</h2>
      <p>
        When you sign in, we set cookies that hold your session. They can’t be read by scripts on
        the page, they are sent only over HTTPS, and they are removed when you sign out or the
        session ends. Without them you can’t stay signed in, so they are not optional.
      </p>
      <ul>
        <li>
          <strong>Staff sessions:</strong> a short-lived access token, a refresh token and your
          role.
        </li>
        <li>
          <strong>Player sessions:</strong> the same three, kept separate from staff sessions.
        </li>
      </ul>

      <h2>Stored in your browser</h2>
      <p>
        We remember a few preferences in your browser’s local storage, such as light or dark theme.
        They never leave your device.
      </p>

      <h2>What we don’t use</h2>
      <p>No advertising cookies, no analytics or tracking cookies, and no third-party trackers.</p>
    </LegalPage>
  );
}
