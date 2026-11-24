import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage } from '@/components/landing/prose';
import { COMPANY } from '@/components/landing/site-shell';

export const metadata: Metadata = { title: 'Terms of service' };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      summary={`The agreement between ${COMPANY.name} and the operators, staff and players who use ${COMPANY.product}.`}
    >
      <h2>1. Who these terms are between</h2>
      <p>
        These terms are an agreement between {COMPANY.name} (“we”, “us”) and you. They apply to the
        website at {COMPANY.domain} and to the {COMPANY.product} application (together, the
        “Service”).
      </p>
      <ul>
        <li>
          An <strong>operator</strong> is the business that signs up for the Service and runs stores
          on it. The person accepting these terms for an operator confirms they can bind it.
        </li>
        <li>
          <strong>Staff</strong> are the master, managers and stores an operator gives access to.
        </li>
        <li>
          <strong>Players</strong> are the operator’s customers who use the player portal.
        </li>
      </ul>
      <p>
        If an operator has signed a separate written agreement with us, that agreement wins where it
        differs from these terms.
      </p>

      <h2>2. What the Service does</h2>
      <p>
        {COMPANY.product} lets operators keep player records, record visits and balances, run VIP
        tiers and referrals, and message players and staff. It is record-keeping and communication
        software. It does not offer, host or run games or wagering, and it does not hold or move
        money.
      </p>

      <h2>3. Operators’ responsibilities</h2>
      <ul>
        <li>
          Holding every licence and approval their business needs, and running it within the laws
          that apply to them and their players.
        </li>
        <li>Only giving player accounts to people old enough to use them where they live.</li>
        <li>
          The accuracy of what their staff record, and the instructions they give us about their
          players’ data (see the <Link href="/legal/data-processing">data processing terms</Link>).
        </li>
        <li>Keeping staff sign-ins private and removing access when someone leaves.</li>
      </ul>

      <h2>4. Accounts</h2>
      <p>
        Keep your password private. Tell us straight away if you think someone else has used your
        account. Players’ accounts are created and managed by their operator; questions about a
        player account go to that operator first.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use the Service for anything unlawful, or to harass, threaten or defraud anyone;</li>
        <li>try to reach data your role does not give you access to;</li>
        <li>
          probe, scan or test the Service’s security, except as described on our{' '}
          <Link href="/security">security page</Link>;
        </li>
        <li>upload malware, or files you do not have the right to share;</li>
        <li>resell or rebrand the Service without our written agreement.</li>
      </ul>

      <h2>6. Data</h2>
      <p>
        Operators own the data they and their staff put into the Service, and can export it at any
        time. We use it only to provide the Service, as described in our{' '}
        <Link href="/legal/privacy">privacy policy</Link> and{' '}
        <Link href="/legal/data-processing">data processing terms</Link>.
      </p>

      <h2>7. Fees</h2>
      <p>
        Operators pay the fees in their order or quote. Unless that says otherwise, fees are billed
        in advance, are not refundable for partial periods, and exclude taxes.
      </p>

      <h2>8. Availability and changes</h2>
      <p>
        We work to keep the Service available and may change or improve it over time. If we remove
        something an operator relies on, we will give reasonable notice.
      </p>

      <h2>9. Suspension and ending</h2>
      <p>
        Operators can stop using the Service at any time. We may suspend access that breaks these
        terms or puts the Service or others at risk, and will tell the operator why when we can.
        When an operator leaves, they have 30 days to export their data, after which we delete it.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        The Service is provided “as is”. To the extent the law allows, we disclaim implied
        warranties, including fitness for a particular purpose. We are not responsible for
        operators’ decisions, or for their compliance with gaming law.
      </p>

      <h2>11. Limit of liability</h2>
      <p>
        To the extent the law allows, neither side is liable for indirect or consequential losses,
        and our total liability for any claim is limited to the fees the operator paid us in the 12
        months before it arose.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These terms are governed by the laws of the State of Texas, USA, without regard to its
        conflict-of-law rules. Disputes go to the state or federal courts located in Texas.
      </p>

      <h2>13. Changes to these terms</h2>
      <p>
        We may update these terms. We will post the new version here with a new date, and tell
        operators by email before material changes take effect.
      </p>
    </LegalPage>
  );
}
