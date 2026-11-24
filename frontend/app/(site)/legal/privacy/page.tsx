import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage } from '@/components/landing/prose';
import { COMPANY } from '@/components/landing/site-shell';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      summary={`What ${COMPANY.product} collects, why, who can see it, and how to ask for a copy or deletion.`}
    >
      <h2>Two different roles</h2>
      <p>
        For <strong>player and staff data</strong> inside an operator’s account, the operator
        decides what is collected and why, and we process it on their behalf, as set out in our{' '}
        <Link href="/legal/data-processing">data processing terms</Link>. If you are a player, your
        store is the first place to ask about your data.
      </p>
      <p>
        For <strong>this website</strong> and for operators’ own business contacts, {COMPANY.name}{' '}
        decides how the data is used, and this policy describes it.
      </p>

      <h2>What we collect</h2>
      <h3>Player accounts</h3>
      <ul>
        <li>Username, email, name, and optionally phone, city, state and country.</li>
        <li>Visits recorded by the store: amounts, games and dates, and the resulting balance.</li>
        <li>Messages with the store, and any files attached to them.</li>
        <li>VIP status, milestones and referral activity.</li>
      </ul>
      <h3>Staff accounts</h3>
      <ul>
        <li>Username, email, name and role, and their messages with players and colleagues.</li>
        <li>A record of the changes they make, kept in the audit trail.</li>
      </ul>
      <h3>Everyone who signs in</h3>
      <ul>
        <li>
          Sign-in sessions, including the IP address and browser they came from, for security and
          the audit trail.
        </li>
      </ul>
      <h3>Website visitors</h3>
      <ul>
        <li>What you type into the demo request form: name, work email, company and message.</li>
      </ul>
      <p>We don’t use advertising or analytics trackers, and we don’t sell personal data.</p>

      <h2>Why we use it</h2>
      <ul>
        <li>To run the Service for the operator: records, messaging, tiers and referrals.</li>
        <li>To keep accounts secure and investigate misuse.</li>
        <li>
          To send the emails the operator asks us to send, such as password resets and broadcasts.
        </li>
        <li>To reply to demo requests and support questions.</li>
      </ul>

      <h2>Who can see it</h2>
      <p>
        Inside the Service, access follows the operator’s chain: a store sees its own players, a
        manager sees their stores, and the master sees everything. Outside the operator, data is
        handled only by the providers we use to run the Service:
      </p>
      <ul>
        <li>Railway, for hosting the application and database in the United States.</li>
        <li>Cloudflare, for storing files attached to messages.</li>
        <li>Resend, for sending email.</li>
      </ul>
      <p>We may also disclose data where the law requires it.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep data for as long as the operator’s account is active. Suspended players keep their
        history so the operator’s records stay complete. When an operator leaves, we delete their
        data 30 days after the account closes. Demo requests are kept in our inbox only as long as
        we need them to follow up.
      </p>

      <h2>Your choices</h2>
      <p>
        You can ask for a copy of your data, a correction or deletion. Players should start with
        their store, which manages their account; we will help the operator respond. For anything
        else, email <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>.
      </p>

      <h2>Children</h2>
      <p>
        The Service is not for children. Operators may only give player accounts to people old
        enough to use them where they live.
      </p>

      <h2>Changes</h2>
      <p>We will post any changes here with a new date at the top.</p>
    </LegalPage>
  );
}
