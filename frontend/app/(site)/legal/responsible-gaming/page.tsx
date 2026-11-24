import type { Metadata } from 'next';

import { LegalPage } from '@/components/landing/prose';
import { COMPANY } from '@/components/landing/site-shell';

export const metadata: Metadata = { title: 'Responsible gaming' };

export default function ResponsibleGamingPage() {
  return (
    <LegalPage
      title="Responsible gaming"
      summary={`How ${COMPANY.product} is designed, and where players can get help.`}
    >
      <h2>What we are, and aren’t</h2>
      <p>
        {COMPANY.product} is record-keeping and messaging software for operators. It does not offer,
        host or run games or wagering, and it does not take or pay out money. Each operator is
        responsible for its licences and for following the gaming laws where it and its players are.
      </p>

      <h2>How the product is designed</h2>
      <ul>
        <li>
          <strong>Milestones reward loyalty, not spending.</strong> Players earn them for joining,
          messaging, inviting friends and time with their store. None are tied to how much they
          deposit.
        </li>
        <li>
          <strong>No pressure tactics.</strong> No countdown timers, spending streaks or prompts to
          deposit more.
        </li>
        <li>
          <strong>A direct line to a person.</strong> Players can message their store at any time,
          including to ask for help or a break.
        </li>
        <li>
          <strong>Accounts can be paused.</strong> Stores can suspend a player’s account at the
          player’s request; their history is kept and the account can be reopened later.
        </li>
      </ul>

      <h2>For players</h2>
      <p>
        If playing has stopped being fun, message your store to ask for your account to be paused.
        Free, confidential help is available in the United States around the clock from the National
        Problem Gambling Helpline at <a href="tel:18004262537">1-800-GAMBLER</a>.
      </p>
      <p>Players must be old enough to play where they live.</p>
    </LegalPage>
  );
}
