import type { ReactNode } from 'react';

import { COMPANY, PageIntro } from './site-shell';

/** Long-form text on the public pages: legal documents, security notes. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="text-lp-text/90 max-w-[68ch] text-[17px] leading-[1.75] [&_a]:text-lp-primary [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:leading-tight [&_h2]:font-extrabold [&_h2]:text-lp-text [&_h2]:[font-stretch:112%] [&_h2:first-child]:mt-0 [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:font-bold [&_h3]:text-lp-text [&_li]:mt-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-4 [&_strong]:text-lp-text [&_ul]:list-disc [&_ul]:pl-6">
      {children}
    </div>
  );
}

export const LAST_UPDATED = 'November 24, 2026';

/**
 * A legal document: title, date, the text, and who to ask about it.
 * The contents are drafts written for Howdi chat as it works today.
 */
export function LegalPage({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <>
      <PageIntro title={title} body={summary} />
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <p className="text-lp-dim mb-10 text-sm">Last updated {LAST_UPDATED}</p>
        <Prose>
          {children}
          <h2>Questions</h2>
          <p>
            Write to <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>.{' '}
            {COMPANY.name} is based in {COMPANY.location}.
          </p>
        </Prose>
      </div>
    </>
  );
}
