import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";

export interface OutgoingMail {
  to: string;
  subject: string;
  /** Rendered HTML body. */
  html: string;
  /** Plain-text fallback, for clients that refuse HTML. */
  text: string;
}

/**
 * Built once and reused: a transport per email would open a new SMTP
 * connection every time. Null when SMTP_HOST is empty, which is how sending
 * is switched off — a fresh checkout and the test suite both run that way and
 * must not try to reach a mail server.
 */
let transport: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (transport !== undefined) return transport;

  if (!env.SMTP_HOST) {
    transport = null;
    return transport;
  }

  transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    // A dev mail catcher has no credentials; passing empty strings would make
    // nodemailer attempt AUTH and be rejected.
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });

  return transport;
}

export const mailer = {
  /** True when a mail server is configured. Exposed so callers can skip work that only exists to build an email. */
  isEnabled(): boolean {
    return Boolean(env.SMTP_HOST);
  },

  /**
   * Sends one message. Never throws and never rejects: a notification is a
   * courtesy on top of an action that already succeeded, so a mail server
   * being down must not turn a completed registration or payment into an
   * error for the user. Failures are logged and dropped.
   */
  async send(mail: OutgoingMail): Promise<void> {
    const activeTransport = getTransport();
    if (!activeTransport) return;

    try {
      await activeTransport.sendMail({
        from: env.MAIL_FROM,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to send "${mail.subject}" to ${mail.to}:`, error);
    }
  },

  /** Test seam: forces the transport to be rebuilt from the current env. */
  reset(): void {
    transport = undefined;
  },
};
