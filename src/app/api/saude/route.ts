import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/**
 * Healthcheck para orquestrador (Docker, Kubernetes, load balancer).
 * Verifica a conectividade real com o banco — responder 200 sem banco daria
 * um "saudável" falso e manteria tráfego indo para uma instância quebrada.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', database: 'ok', at: new Date().toISOString() });
  } catch (error) {
    console.error('[saude] banco indisponível:', error);
    return NextResponse.json(
      { status: 'degraded', database: 'erro', at: new Date().toISOString() },
      { status: 503 },
    );
  }
}
