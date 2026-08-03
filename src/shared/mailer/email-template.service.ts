import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';
import { SHADCN } from './email-theme';
import { EmailKind } from '@common/constants/app.constants';

export { EmailKind };

interface IKindStyle {
  accent: string;
  /** Tint behind the badge, matching how shadcn renders a soft badge variant. */
  badgeBg: string;
  badgeFg: string;
  label: string;
  /** Marketing mail must offer an opt-out; transactional mail must not. */
  showUnsubscribe: boolean;
}

/**
 * Per-kind styling, drawn from the shadcn palette.
 *
 * Informational and transactional both use `primary`, because shadcn has
 * no separate "info" token and inventing one would drift from the app.
 */
const KIND_STYLES: Readonly<Record<EmailKind, IKindStyle>> = Object.freeze({
  [EmailKind.PROMOTIONAL]: {
    accent: SHADCN.violet,
    badgeBg: '#f5f3ff',
    badgeFg: '#6d28d9',
    label: 'Offer',
    showUnsubscribe: true,
  },
  [EmailKind.INFORMATIONAL]: {
    accent: SHADCN.primary,
    badgeBg: SHADCN.secondary,
    badgeFg: SHADCN.primary,
    label: 'Update',
    showUnsubscribe: true,
  },
  [EmailKind.NOTIFICATION]: {
    accent: SHADCN.success,
    badgeBg: '#ecfdf5',
    badgeFg: '#047857',
    label: 'Notification',
    showUnsubscribe: false,
  },
  [EmailKind.TRANSACTIONAL]: {
    accent: SHADCN.primary,
    badgeBg: SHADCN.secondary,
    badgeFg: SHADCN.primary,
    label: 'Account',
    showUnsubscribe: false,
  },
  [EmailKind.ALERT]: {
    accent: SHADCN.destructive,
    badgeBg: '#fef2f2',
    badgeFg: '#b91c1c',
    label: 'Important',
    showUnsubscribe: false,
  },
});

export interface IRenderInput {
  kind: EmailKind;
  subject: string;
  /** Body as HTML or plain text; plain text is converted to paragraphs. */
  body: string;
  recipientName?: string;
  action?: { label: string; url: string };
  footnote?: string;
  unsubscribeUrl?: string;
}

export interface IRenderedEmail {
  html: string;
  text: string;
}

/**
 * Wraps message bodies in the house layout.
 *
 * The visual language mirrors shadcn/ui — same palette, radii, border and
 * font stack — so email and app read as one product. See email-theme.ts
 * for the token mapping.
 *
 * The markup itself is table-based with inline styles, which is a
 * constraint of email clients rather than a stylistic choice: Outlook
 * ignores flexbox and grid, Gmail strips <style> blocks, and CSS custom
 * properties are unsupported, so shadcn's own CSS cannot be reused
 * directly however much one would like to.
 *
 * A plain-text alternative is always produced. A message with no text part
 * scores badly with spam filters and is unreadable wherever HTML is
 * disabled.
 */
@Injectable()
export class EmailTemplateService implements OnModuleInit {
  private readonly logger = new Logger(EmailTemplateService.name);
  private layout!: HandlebarsTemplateDelegate<Record<string, unknown>>;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.layout = Handlebars.compile(LAYOUT_TEMPLATE);
    this.logger.log('Email templates compiled (shadcn theme)');
  }

  render(input: IRenderInput): IRenderedEmail {
    const style = KIND_STYLES[input.kind] ?? KIND_STYLES[EmailKind.INFORMATIONAL];
    const brand = this.configService.get<string>('mail.fromName', 'Sambehen');

    const html = this.layout({
      brand,
      theme: SHADCN,
      style,
      subject: input.subject,
      greeting: input.recipientName ? `Hi ${input.recipientName},` : 'Hello,',
      bodyHtml: this.toHtmlBody(input.body),
      action: input.action,
      footnote: input.footnote,
      // Only rendered when the kind permits it AND a URL was supplied, so
      // a missing URL never produces a dead link.
      unsubscribeUrl: style.showUnsubscribe ? input.unsubscribeUrl : undefined,
      year: new Date().getFullYear(),
    });

    return { html, text: this.toPlainText(input, style, brand) };
  }

  /** True when this kind of mail may be unsubscribed from. */
  allowsUnsubscribe(kind: EmailKind): boolean {
    return (KIND_STYLES[kind] ?? KIND_STYLES[EmailKind.INFORMATIONAL]).showUnsubscribe;
  }

  /**
   * Accepts either HTML or plain text.
   *
   * Staff compose in a plain textarea far more often than they write
   * markup, so a body with no tags is split into paragraphs rather than
   * rendered as one unbroken block.
   */
  private toHtmlBody(body: string): Handlebars.SafeString {
    if (/<\/?[a-z][\s\S]*>/i.test(body)) return new Handlebars.SafeString(body);

    const paragraphs = body
      .split(/\n{2,}/)
      .map((block) => Handlebars.escapeExpression(block.trim()).replace(/\n/g, '<br />'))
      .filter(Boolean)
      .map(
        (block) =>
          `<p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:${SHADCN.foreground};">${block}</p>`,
      )
      .join('');

    return new Handlebars.SafeString(paragraphs);
  }

  /** Plain-text alternative, with tags stripped if the body was HTML. */
  private toPlainText(input: IRenderInput, style: IKindStyle, brand: string): string {
    const stripped = input.body
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const parts = [
      `${brand} — ${style.label}`,
      '',
      input.recipientName ? `Hi ${input.recipientName},` : 'Hello,',
      '',
      stripped,
    ];

    if (input.action) parts.push('', `${input.action.label}: ${input.action.url}`);
    if (input.footnote) parts.push('', input.footnote);
    if (style.showUnsubscribe && input.unsubscribeUrl) {
      parts.push('', `Unsubscribe: ${input.unsubscribeUrl}`);
    }

    parts.push('', `© ${new Date().getFullYear()} ${brand}`);
    return parts.join('\n');
  }
}

/**
 * The house layout: a shadcn Card rendered in email-safe markup.
 *
 * Tables, inline styles, a 600px column and no external assets — each one
 * required by email clients rather than chosen.
 */
const LAYOUT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:{{theme.muted}};font-family:{{theme.fontFamily}};-webkit-font-smoothing:antialiased;">

  <!-- Preheader: shown in the inbox preview, hidden in the message body. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{subject}}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{{theme.muted}};padding:32px 12px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background-color:{{theme.card}};border:1px solid {{theme.border}};border-radius:{{theme.radius}};overflow:hidden;">

          <!-- Accent rule, echoing the shadcn card top border -->
          <tr><td style="height:3px;background-color:{{style.accent}};font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- Header -->
          <tr>
            <td style="padding:24px 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:15px;font-weight:600;letter-spacing:-0.01em;color:{{theme.foreground}};">{{brand}}</td>
                  <td align="right">
                    <!-- Badge, matching shadcn's soft variant -->
                    <span style="display:inline-block;padding:3px 10px;border-radius:9999px;background-color:{{style.badgeBg}};color:{{style.badgeFg}};font-size:11px;font-weight:600;letter-spacing:0.02em;">{{style.label}}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:20px 28px 28px;">
              <h1 style="margin:0 0 6px;font-size:20px;line-height:1.3;font-weight:600;letter-spacing:-0.02em;color:{{theme.foreground}};">{{subject}}</h1>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:{{theme.mutedForeground}};">{{greeting}}</p>

              {{{bodyHtml}}}

              {{#if action}}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px;">
                <tr>
                  <td style="background-color:{{style.accent}};border-radius:{{theme.radiusSm}};">
                    <a href="{{action.url}}"
                       style="display:inline-block;padding:10px 20px;font-size:14px;font-weight:500;color:{{theme.primaryForeground}};text-decoration:none;">{{action.label}}</a>
                  </td>
                </tr>
              </table>
              {{/if}}

              {{#if footnote}}
              <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid {{theme.border}};font-size:13px;line-height:1.55;color:{{theme.mutedForeground}};">{{footnote}}</p>
              {{/if}}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 28px;background-color:{{theme.secondary}};border-top:1px solid {{theme.border}};">
              <p style="margin:0;font-size:12px;line-height:1.55;color:{{theme.mutedForeground}};">
                &copy; {{year}} {{brand}}.
                {{#if unsubscribeUrl}}
                <br /><a href="{{unsubscribeUrl}}" style="color:{{theme.mutedForeground}};text-decoration:underline;">Unsubscribe from these emails</a>
                {{/if}}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
