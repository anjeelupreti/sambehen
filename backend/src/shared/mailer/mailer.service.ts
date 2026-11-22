import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface ISendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface ISendMailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /** False for a permanent failure, so the dispatcher does not retry it. */
  retryable: boolean;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Mail transport: Resend's HTTPS API when `RESEND_API_KEY` is set, SMTP
 * otherwise.
 *
 * Resend goes over HTTPS rather than its SMTP relay because hosts such as
 * Railway block outbound SMTP ports (25/465/587) on their lower plans.
 *
 * Deliberately the only place a mail transport is referenced: everything
 * else depends on this interface, so swapping providers touches one file
 * rather than the campaign pipeline.
 *
 * `send` never throws. A campaign of a thousand recipients must not stop
 * because one address is malformed, so failures come back as a result the
 * dispatcher records against that recipient.
 */
@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transporter?: nodemailer.Transporter;
  private resendApiKey = '';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.resendApiKey = this.configService.get<string>('mail.resendApiKey', '');
    if (this.resendApiKey) {
      this.logger.log('Mail transport configured for Resend (HTTPS API)');
      return;
    }

    const host = this.configService.get<string>('mail.host', 'localhost');
    const port = this.configService.get<number>('mail.port', 587);
    const user = this.configService.get<string>('mail.user', '');
    const password = this.configService.get<string>('mail.password', '');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: this.configService.get<boolean>('mail.secure', false),
      // Omit auth entirely when no credentials are configured; passing
      // empty strings makes most servers reject the connection outright.
      auth: user ? { user, pass: password } : undefined,
      pool: true,
      maxConnections: 3,
    });

    this.logger.log(`Mail transport configured for ${host}:${port}`);
  }

  async send(input: ISendMailInput): Promise<ISendMailResult> {
    const from = this.configService.get<string>('mail.from', 'no-reply@sambehen.local');
    const fromName = this.configService.get<string>('mail.fromName', 'Howdi chat');

    if (this.resendApiKey) return this.sendViaResend(input, `${fromName} <${from}>`);

    try {
      const info = await this.transporter!.sendMail({
        from: `"${fromName}" <${from}>`,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });

      return { success: true, messageId: info.messageId, retryable: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return { success: false, error: message, retryable: this.isRetryable(error) };
    }
  }

  private async sendViaResend(input: ISendMailInput, from: string): Promise<ISendMailResult> {
    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          text: input.text,
          html: input.html,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };

      if (response.ok) return { success: true, messageId: body.id, retryable: false };

      // 429 (rate limit) and 5xx are transient; any other 4xx — an
      // unverified sender domain, an invalid address — will fail again.
      const retryable = response.status === 429 || response.status >= 500;
      return {
        success: false,
        error: `Resend ${response.status}: ${body.message ?? response.statusText}`,
        retryable,
      };
    } catch (error) {
      // Network failure or timeout: worth another attempt.
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message, retryable: true };
    }
  }

  /**
   * Distinguishes a transient failure from a permanent one.
   *
   * Retrying a 5xx SMTP rejection — an address that does not exist, say —
   * wastes attempts and can harm sender reputation, so only connection
   * problems and 4xx responses are worth another go.
   */
  private isRetryable(error: unknown): boolean {
    const code = (error as { responseCode?: number; code?: string })?.responseCode;
    if (typeof code === 'number') return code >= 400 && code < 500;

    const errno = (error as { code?: string })?.code;
    return ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ESOCKET', 'EAI_AGAIN'].includes(
      errno ?? '',
    );
  }

  /** Connectivity probe, for the health endpoint. */
  async verify(): Promise<boolean> {
    // A sending-only Resend key cannot call any read endpoint, so there is
    // nothing to probe beyond the key being present.
    if (this.resendApiKey) return true;

    try {
      await this.transporter!.verify();
      return true;
    } catch {
      return false;
    }
  }
}
