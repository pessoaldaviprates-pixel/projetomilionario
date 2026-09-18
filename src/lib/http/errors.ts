/**
 * Erros de domínio.
 *
 * Services lançam estes erros; a camada HTTP os traduz para status codes.
 * Mensagens são escritas para o usuário final (pt-BR) e nunca contêm detalhes
 * internos como nomes de tabela, SQL ou stack.
 */

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status = 400, code = 'bad_request', details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos.', details?: unknown) {
    super(message, 422, 'validation_error', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Você precisa entrar para continuar.') {
    super(message, 401, 'unauthorized');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Você não tem permissão para executar esta ação.') {
    super(message, 403, 'forbidden');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Registro não encontrado.') {
    super(message, 404, 'not_found');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Este registro já existe.') {
    super(message, 409, 'conflict');
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number, message = 'Muitas tentativas. Aguarde um momento.') {
    super(message, 429, 'rate_limited');
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class PaymentRequiredError extends AppError {
  constructor(message = 'Seu plano atual não inclui este recurso.') {
    super(message, 402, 'payment_required');
  }
}
