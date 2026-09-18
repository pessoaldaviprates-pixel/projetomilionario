import 'server-only';
import { env } from '@/lib/env';
import type { MailMessage } from './index';

function layout(title: string, body: string, cta?: { label: string; href: string }): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#05070D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#E6EDF7">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#0A0F1A;border:1px solid #1B2436;border-radius:16px;padding:32px">
        <tr><td style="font-size:20px;font-weight:700;color:#FFFFFF;padding-bottom:8px">Nexora</td></tr>
        <tr><td style="font-size:12px;color:#7A8AA3;letter-spacing:.08em;text-transform:uppercase;padding-bottom:24px">Pessoas + Processos + Resultados</td></tr>
        <tr><td style="font-size:18px;font-weight:600;color:#FFFFFF;padding-bottom:12px">${title}</td></tr>
        <tr><td style="font-size:14px;line-height:1.6;color:#B8C4D9">${body}</td></tr>
        ${cta ? `<tr><td style="padding-top:24px"><a href="${cta.href}" style="display:inline-block;background:#2E7DFF;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px">${cta.label}</a></td></tr>
        <tr><td style="padding-top:16px;font-size:12px;color:#5B6B85;word-break:break-all">Se o botão não funcionar, copie este endereço: ${cta.href}</td></tr>` : ''}
        <tr><td style="padding-top:32px;border-top:1px solid #1B2436;font-size:12px;color:#5B6B85">Você recebeu este e-mail porque existe uma conta Nexora associada a este endereço.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function emailVerificationMail(to: string, name: string, token: string): MailMessage {
  const href = `${env.appUrl}/verificar-email?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: 'Confirme seu e-mail · Nexora',
    html: layout(
      `Olá, ${name}!`,
      'Confirme seu endereço de e-mail para ativar sua conta na Nexora. O link expira em 24 horas.',
      { label: 'Confirmar e-mail', href },
    ),
    text: `Olá, ${name}!\n\nConfirme seu e-mail para ativar sua conta na Nexora:\n${href}\n\nO link expira em 24 horas.`,
  };
}

export function passwordResetMail(to: string, name: string, token: string): MailMessage {
  const href = `${env.appUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: 'Redefinição de senha · Nexora',
    html: layout(
      `Olá, ${name}!`,
      'Recebemos um pedido para redefinir sua senha. O link expira em 1 hora. Se não foi você, ignore este e-mail — nada será alterado.',
      { label: 'Criar nova senha', href },
    ),
    text: `Olá, ${name}!\n\nPara redefinir sua senha, acesse:\n${href}\n\nO link expira em 1 hora. Se não foi você, ignore este e-mail.`,
  };
}

export function invitationMail(
  to: string,
  companyName: string,
  inviterName: string,
  token: string,
): MailMessage {
  const href = `${env.appUrl}/convite?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: `${inviterName} convidou você para a ${companyName} · Nexora`,
    html: layout(
      `Você foi convidado para a ${companyName}`,
      `${inviterName} convidou você para fazer parte da equipe na Nexora — onde a empresa conversa, organiza tarefas, projetos e reuniões em um só lugar.`,
      { label: 'Aceitar convite', href },
    ),
    text: `${inviterName} convidou você para a ${companyName} na Nexora.\n\nAceite o convite:\n${href}`,
  };
}
