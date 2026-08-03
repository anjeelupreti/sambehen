import { registerAs } from '@nestjs/config';

/**
 * SMTP transport settings.
 *
 * Consumed by MailerService behind a provider interface, so swapping in
 * SendGrid/SES/Resend later touches one adapter rather than the campaign
 * pipeline.
 */
export default registerAs('mail', () => ({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER || '',
  password: process.env.SMTP_PASSWORD || '',
  from: process.env.MAIL_FROM || 'no-reply@sambehen.local',
  fromName: process.env.MAIL_FROM_NAME || 'Sambehen',
  /** Public origin used to build unsubscribe and download links in emails. */
  publicUrl: process.env.APP_PUBLIC_URL || 'http://localhost:3000',
}));
