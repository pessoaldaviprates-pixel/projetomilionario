/**
 * Rate limiting por janela deslizante.
 *
 * Implementação in-memory: correta para uma instância e suficiente para o MVP.
 * A interface `RateLimiter` permite trocar por Redis/Upstash em produção
 * multi-instância sem tocar nos call sites (ver docs/ARQUITETURA.md).
 */
import 'server-only';
import { env } from '@/lib/env';
import { RateLimitError } from './errors';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, number[]>();
  private lastSweep = Date.now();

  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    this.sweep(now);

    const timestamps = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);

    if (timestamps.length >= limit) {
      const oldest = timestamps[0] ?? now;
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
      this.hits.set(key, timestamps);
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);
    return { allowed: true, remaining: limit - timestamps.length, retryAfterSeconds: 0 };
  }

  /** Evita crescimento indefinido do Map em processos de vida longa. */
  private sweep(now: number) {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    const cutoff = now - 15 * 60_000;
    for (const [key, timestamps] of this.hits) {
      const fresh = timestamps.filter((t) => t > cutoff);
      if (fresh.length === 0) this.hits.delete(key);
      else this.hits.set(key, fresh);
    }
  }
}

const globalForLimiter = globalThis as unknown as { nexoraRateLimiter?: RateLimiter };
export const rateLimiter: RateLimiter = globalForLimiter.nexoraRateLimiter ?? new MemoryRateLimiter();
globalForLimiter.nexoraRateLimiter = rateLimiter;

/** Políticas nomeadas — centralizadas para auditoria de segurança. */
export const RATE_LIMITS = {
  login: { limit: 8, windowMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 5, windowMs: 60 * 60_000 },
  message: { limit: 60, windowMs: 60_000 },
  upload: { limit: 30, windowMs: 60_000 },
  ai: { limit: 30, windowMs: 60_000 },
  mutation: { limit: 120, windowMs: 60_000 },
} as const;

export async function enforceRateLimit(
  policy: keyof typeof RATE_LIMITS,
  identifier: string,
): Promise<void> {
  if (!env.rateLimitEnabled) return;
  const { limit, windowMs } = RATE_LIMITS[policy];
  const result = await rateLimiter.check(`${policy}:${identifier}`, limit, windowMs);
  if (!result.allowed) throw new RateLimitError(result.retryAfterSeconds);
}
