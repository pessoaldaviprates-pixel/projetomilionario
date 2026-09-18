/**
 * Gateway de pagamento.
 *
 * IMPORTANTE: nenhum dado sensível de cartão trafega ou é persistido por nós.
 * A interface abaixo assume tokenização no cliente (Stripe Elements / SDK do
 * adquirente): o servidor recebe apenas um TOKEN opaco, e guarda no máximo
 * bandeira e 4 últimos dígitos para exibição.
 *
 * O driver `manual` registra a intenção de pagamento no banco e mantém o
 * fluxo completo navegável em desenvolvimento, sem simular aprovação de cartão
 * real: pagamentos ficam PENDING até confirmação externa (webhook).
 */
import 'server-only';
import { randomUUID } from 'node:crypto';
import { env } from '@/lib/env';
import type { PaymentMethod } from '@/generated/prisma/enums';

export interface ChargeInput {
  companyId: string;
  amountCents: number;
  currency: string;
  method: PaymentMethod;
  description: string;
  /** Token opaco vindo do SDK do gateway. NUNCA o PAN do cartão. */
  paymentToken?: string;
  customerEmail: string;
}

export interface ChargeResult {
  providerPaymentId: string;
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';
  /** Dados de exibição do meio de pagamento (não sensíveis). */
  cardBrand?: string;
  cardLast4?: string;
  pixQrCode?: string;
  boletoUrl?: string;
  invoiceUrl?: string;
  failureReason?: string;
}

export interface PaymentGateway {
  readonly name: string;
  createCharge(input: ChargeInput): Promise<ChargeResult>;
  /** Valida a assinatura do webhook antes de confiar no corpo. */
  verifyWebhook(rawBody: string, signature: string | null): boolean;
}

class ManualGateway implements PaymentGateway {
  readonly name = 'manual';

  async createCharge(input: ChargeInput): Promise<ChargeResult> {
    const providerPaymentId = `manual_${randomUUID()}`;

    if (input.method === 'PIX') {
      return {
        providerPaymentId,
        status: 'PENDING',
        // Payload PIX real é emitido pelo PSP; aqui devolvemos um identificador
        // de cobrança para o front exibir enquanto a integração não existe.
        pixQrCode: providerPaymentId,
      };
    }

    if (input.method === 'BOLETO') {
      return { providerPaymentId, status: 'PENDING', boletoUrl: `${env.appUrl}/faturas/${providerPaymentId}` };
    }

    // Cartão: sem adquirente configurado a cobrança fica pendente de confirmação.
    return {
      providerPaymentId,
      status: 'PENDING',
      cardBrand: 'pendente',
      cardLast4: undefined,
    };
  }

  verifyWebhook(): boolean {
    // Sem segredo compartilhado não há como verificar origem: recusamos.
    return false;
  }
}

class StripeGateway implements PaymentGateway {
  readonly name = 'stripe';

  async createCharge(): Promise<ChargeResult> {
    throw new Error('Gateway Stripe ainda não configurado. Use BILLING_PROVIDER=manual.');
  }

  verifyWebhook(rawBody: string, signature: string | null): boolean {
    if (!signature || !env.billing.stripeWebhookSecret) return false;
    throw new Error('Verificação de webhook Stripe ainda não configurada.');
  }
}

export const gateway: PaymentGateway =
  env.billing.provider === 'stripe' ? new StripeGateway() : new ManualGateway();
