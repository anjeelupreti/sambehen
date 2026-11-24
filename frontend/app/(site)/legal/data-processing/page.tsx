import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage } from '@/components/landing/prose';
import { COMPANY } from '@/components/landing/site-shell';

export const metadata: Metadata = { title: 'Data processing terms' };

export default function DataProcessingPage() {
  return (
    <LegalPage
      title="Data processing terms"
      summary={`How ${COMPANY.name} handles the player and staff data operators put into ${COMPANY.product}.`}
    >
      <p>
        These terms form part of the <Link href="/legal/terms">terms of service</Link>. They apply
        whenever {COMPANY.name} processes personal data on an operator’s behalf.
      </p>

      <h2>1. Roles</h2>
      <p>
        The operator decides what personal data is processed and why. {COMPANY.name} processes it
        only to provide the Service and on the operator’s documented instructions, which include
        using the Service as designed and anything the operator asks us in writing.
      </p>

      <h2>2. What is processed</h2>
      <ul>
        <li>
          <strong>People:</strong> the operator’s players and staff.
        </li>
        <li>
          <strong>Data:</strong> contact details, account details, recorded visits and balances,
          messages and attachments, VIP and referral activity, sign-in records and audit history.
        </li>
        <li>
          <strong>Purpose:</strong> running player records, messaging, tiers, referrals and email
          for the operator.
        </li>
        <li>
          <strong>Duration:</strong> while the operator’s account is active, plus 30 days to allow
          export.
        </li>
      </ul>

      <h2>3. Our commitments</h2>
      <ul>
        <li>
          People at {COMPANY.name} with access to operator data are bound to keep it confidential.
        </li>
        <li>
          We maintain the safeguards described on our <Link href="/security">security page</Link>,
          including access by store, separate staff and player sign-ins, an audit trail and
          encrypted connections.
        </li>
        <li>
          We help the operator respond to requests from players to see, correct or delete their
          data.
        </li>
        <li>
          We tell the operator without undue delay after becoming aware of a breach affecting their
          data, with what we know and what we are doing about it.
        </li>
        <li>
          At the end of the account, we delete the operator’s data once the export window has
          passed.
        </li>
      </ul>

      <h2>4. Sub-processors</h2>
      <p>We use these providers to run the Service:</p>
      <ul>
        <li>
          <strong>Railway</strong>: application and database hosting, United States.
        </li>
        <li>
          <strong>Cloudflare</strong>: storage of message attachments.
        </li>
        <li>
          <strong>Resend</strong>: sending email.
        </li>
      </ul>
      <p>We will tell operators before adding or replacing a sub-processor, so they can object.</p>

      <h2>5. Information and audits</h2>
      <p>
        We will answer reasonable questions about how we protect operator data, and make available
        the information needed to show we meet these terms.
      </p>
    </LegalPage>
  );
}
