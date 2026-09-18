/**
 * Camada de rota HTTP.
 *
 * Um único wrapper (`route`) garante para toda rota da API:
 *   1. autenticação e tenant resolvidos no servidor;
 *   2. validação de corpo/query com zod antes de tocar no banco;
 *   3. tradução uniforme de erro → status;
 *   4. nenhum detalhe interno vazando para o cliente em produção.
 */
import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import type { AuthContext } from '@/lib/auth/context';
import { getAuthContext } from '@/lib/auth/context';
import { env } from '@/lib/env';
import { translatePrismaError } from '@/lib/db/errors';
import { AppError, RateLimitError, UnauthorizedError, ValidationError } from './errors';

export interface ApiSuccess<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export function ok<T>(data: T, meta?: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ data, ...(meta ? { meta } : {}) }, init);
}

export function created<T>(data: T) {
  return ok(data, undefined, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

/** Converte qualquer exceção em resposta segura. */
export function handleError(error: unknown): NextResponse {
  if (error instanceof RateLimitError) {
    const response = errorResponse(error.status, error.code, error.message);
    response.headers.set('Retry-After', String(error.retryAfterSeconds));
    return response;
  }

  if (error instanceof AppError) {
    return errorResponse(error.status, error.code, error.message, error.details);
  }

  if (error instanceof ZodError) {
    return errorResponse(422, 'validation_error', 'Dados inválidos.', formatZodIssues(error));
  }

  const prismaMessage = translatePrismaError(error);
  if (prismaMessage) return errorResponse(409, 'database_error', prismaMessage);

  // Erro inesperado: registra no servidor, devolve mensagem genérica.
  console.error('[api] erro não tratado:', error);
  return errorResponse(
    500,
    'internal_error',
    env.isProduction
      ? 'Não foi possível concluir a operação. Tente novamente.'
      : `Erro interno: ${error instanceof Error ? error.message : String(error)}`,
  );
}

export function formatZodIssues(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_';
    if (!fields[path]) fields[path] = issue.message;
  }
  return fields;
}

export interface RouteContext<TBody, TQuery> {
  request: NextRequest;
  auth: AuthContext;
  body: TBody;
  query: TQuery;
  params: Record<string, string>;
}

interface RouteOptions<TBody, TQuery> {
  body?: ZodType<TBody>;
  query?: ZodType<TQuery>;
  /** Rotas públicas (webhooks, healthcheck) definem auth: false. */
  auth?: boolean;
}

type Handler<TBody, TQuery> = (ctx: RouteContext<TBody, TQuery>) => Promise<NextResponse> | NextResponse;

/**
 * Cria um handler de rota do App Router com auth + validação.
 * Uso: `export const POST = route({ body: schema }, async ({ auth, body }) => …)`
 */
export function route<TBody = undefined, TQuery = undefined>(
  options: RouteOptions<TBody, TQuery>,
  handler: Handler<TBody, TQuery>,
) {
  return async (
    request: NextRequest,
    segment?: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    try {
      const requireAuth = options.auth !== false;
      let auth: AuthContext | null = null;

      if (requireAuth) {
        auth = await getAuthContext();
        if (!auth) throw new UnauthorizedError();
      }

      let body = undefined as TBody;
      if (options.body) {
        const raw = await readJson(request);
        const parsed = options.body.safeParse(raw);
        if (!parsed.success) throw new ValidationError('Dados inválidos.', formatZodIssues(parsed.error));
        body = parsed.data;
      }

      let query = undefined as TQuery;
      if (options.query) {
        const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
        const parsed = options.query.safeParse(raw);
        if (!parsed.success) throw new ValidationError('Parâmetros inválidos.', formatZodIssues(parsed.error));
        query = parsed.data;
      }

      const params = segment?.params ? await segment.params : {};

      return await handler({ request, auth: auth as AuthContext, body, query, params });
    } catch (error) {
      return handleError(error);
    }
  };
}

async function readJson(request: NextRequest): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new ValidationError('Esperado corpo JSON.');
  }
  try {
    return await request.json();
  } catch {
    throw new ValidationError('JSON inválido.');
  }
}

/** IP do cliente considerando proxies confiáveis à frente da aplicação. */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}
