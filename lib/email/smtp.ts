import 'server-only';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { createPaymentLinkEmail } from '@/lib/email/templates';

const smtpSchema = z.object({
  SMTP_HOST: z.string().trim().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_USER: z.string().trim().min(1),
  SMTP_PASSWORD: z.string().min(1),
  SMTP_FROM_EMAIL: z.string().trim().email(),
  SMTP_FROM_NAME: z.string().trim().min(1).max(100),
});

type PaymentLinkMessage = {
  to: string;
  customerName?: string | null;
  orderNumber: string;
  paymentUrl: string;
  totalGross: number;
  expiresAt: Date;
  orderType: 'store' | 'quote';
};

let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null = null;
let cachedFingerprint = '';

function getSmtpEnvironment() {
  const result = smtpSchema.safeParse({
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
    SMTP_FROM_NAME: process.env.SMTP_FROM_NAME,
  });
  return result.success ? result.data : null;
}

function getTransport(environment: NonNullable<ReturnType<typeof getSmtpEnvironment>>) {
  const fingerprint = [
    environment.SMTP_HOST,
    environment.SMTP_PORT,
    environment.SMTP_USER,
  ].join(':');

  if (!cachedTransport || cachedFingerprint !== fingerprint) {
    cachedTransport = nodemailer.createTransport({
      host: environment.SMTP_HOST,
      port: environment.SMTP_PORT,
      secure: environment.SMTP_PORT === 465,
      requireTLS: environment.SMTP_PORT !== 465,
      auth: {
        user: environment.SMTP_USER,
        pass: environment.SMTP_PASSWORD,
      },
      connectionTimeout: 4_000,
      greetingTimeout: 4_000,
      socketTimeout: 6_000,
    });
    cachedFingerprint = fingerprint;
  }
  return cachedTransport;
}

export async function sendPaymentLinkEmailSafely(message: PaymentLinkMessage) {
  const environment = getSmtpEnvironment();
  if (!environment) {
    console.warn('Payment email skipped: SMTP is not configured.');
    return { delivered: false, reason: 'not_configured' } as const;
  }

  try {
    const content = createPaymentLinkEmail(message);
    await getTransport(environment).sendMail({
      from: {
        name: environment.SMTP_FROM_NAME,
        address: environment.SMTP_FROM_EMAIL,
      },
      to: message.to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    return { delivered: true } as const;
  } catch (error) {
    console.error('Payment email delivery failed.', {
      reason: error instanceof Error ? error.name : 'unknown_error',
    });
    return { delivered: false, reason: 'delivery_failed' } as const;
  }
}
