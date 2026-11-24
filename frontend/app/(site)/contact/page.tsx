import type { Metadata } from 'next';
import Image from 'next/image';

import { COMPANY, PageIntro } from '@/components/landing/site-shell';
import { ContactForm } from './contact-form';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Book a demo of Howdi chat, or get in touch with the team.',
};

export default function ContactPage() {
  return (
    <>
      <PageIntro
        title="Book a demo"
        body="Tell us a little about your stores and we’ll set up a time to walk you through it."
      />
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-16 lg:px-8 lg:py-24">
        <ContactForm email={COMPANY.salesEmail} />

        <aside className="space-y-8">
          <Image
            src="/brand/mascot/megaphone.webp"
            alt=""
            width={480}
            height={480}
            className="w-40 select-none sm:w-48"
          />
          <dl className="space-y-6">
            <div>
              <dt className="font-semibold">Sales and demos</dt>
              <dd className="mt-1">
                <a
                  href={`mailto:${COMPANY.salesEmail}`}
                  className="text-lp-primary hover:underline"
                >
                  {COMPANY.salesEmail}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Privacy requests</dt>
              <dd className="mt-1">
                <a
                  href={`mailto:${COMPANY.privacyEmail}`}
                  className="text-lp-primary hover:underline"
                >
                  {COMPANY.privacyEmail}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Already a customer?</dt>
              <dd className="text-lp-dim mt-1 leading-relaxed">
                Message your account contact from the app, or email us with your company’s name.
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Where we are</dt>
              <dd className="text-lp-dim mt-1">{COMPANY.location}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </>
  );
}
