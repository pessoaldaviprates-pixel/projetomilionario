import { NextResponse, type NextRequest } from 'next/server';
import { gateway } from '@/lib/billing/gateway';
import { handleWebhook } from '@/server/services/billing.service';

/**
 * Webhook do gateway de pagamento.
 *
 * Rota pública por natureza — por isso a assinatura é verificada ANTES de
 * qualquer processamento. Sem assinatura válida, nada é lido do corpo.
 * O processamento é idempotente: reentregas do mesmo evento não duplicam efeito.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get('x-signature') ?? request.headers.get('stripe-signature');

  if (!gateway.verifyWebhook(rawBody, signature)) {
    console.warn('[billing] webhook rejeitado: assinatura inválida ou ausente');
    return NextResponse.json({ error: { code: 'invalid_signature', message: 'Assinatura inválida.' } }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: { code: 'invalid_payload', message: 'Corpo inválido.' } }, { status: 400 });
  }

  const eventId = typeof payload.id === 'string' ? payload.id : null;
  const type = typeof payload.type === 'string' ? payload.type : null;

  if (!eventId || !type) {
    return NextResponse.json({ error: { code: 'invalid_payload', message: 'Evento sem id ou tipo.' } }, { status: 400 });
  }

  try {
    const result = await handleWebhook(gateway.name, eventId, type, payload);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error('[billing] falha ao processar webhook:', error);
    // 500 faz o gateway reenviar — o log idempotente evita efeito duplicado.
    return NextResponse.json({ error: { code: 'processing_error', message: 'Falha no processamento.' } }, { status: 500 });
  }
}
