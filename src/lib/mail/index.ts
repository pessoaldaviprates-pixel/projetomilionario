/**
 * Envio de e-mail.
 *
 * Driver `console` imprime o e-mail (inclusive links de verificação) no log do
 * servidor — é o que permite testar todo o fluxo de cadastro/recuperação sem
 * provedor externo. Em produção, `smtp` (ou um provedor HTTP) assume.
 */
import 'server-only';
import { env } from '@/lib/env';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailDriver {
  send(message: MailMessage): Promise<void>;
}

class ConsoleMailDriver implements MailDriver {
  async send(message: MailMessage): Promise<void> {
    console.info(
      [
        '',
        '┌─ NEXORA · E-MAIL (driver console) ─────────────────────────',
        `│ Para:    ${message.to}`,
        `│ Assunto: ${message.subject}`,
        '├────────────────────────────────────────────────────────────',
        message.text
          .split('\n')
          .map((line) => `│ ${line}`)
          .join('\n'),
        '└────────────────────────────────────────────────────────────',
        '',
      ].join('\n'),
    );
  }
}

class SmtpMailDriver implements MailDriver {
  async send(message: MailMessage): Promise<void> {
    // O transporte SMTP real é plugado aqui (nodemailer/Resend/SES).
    // Mantido explícito para não simular sucesso de envio que não aconteceu.
    throw new Error(
      `Driver SMTP não configurado. Defina MAIL_DRIVER=console ou implemente o transporte. (destino: ${message.to})`,
    );
  }
}

export const mailer: MailDriver =
  env.mail.driver === 'smtp' ? new SmtpMailDriver() : new ConsoleMailDriver();

export async function sendMail(message: MailMessage): Promise<void> {
  try {
    await mailer.send(message);
  } catch (error) {
    console.error('[mail] falha no envio para', message.to, error);
    throw error;
  }
}
