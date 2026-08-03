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

/**
 * SMTP transport.
 *
 * Deliberately the only place nodemailer is referenced: everything else
 * depends on this interface, so swapping in SendGrid, SES or Resend later
 * touches one file rather than the campaign pipeline.
 *
 * `send` never throws. A campaign of a thousand recipients must not stop
 * because one address is malformed, so failures come back as a result the
 * dispatcher records against that recipient.
 */
@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transporter!: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
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
    const fromName = this.configService.get<string>('mail.fromName', 'Sambehen');

    try {
      const info = await this.transporter.sendMail({
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
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
