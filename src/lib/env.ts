/**
 * Leitura e validação central de variáveis de ambiente.
 *
 * Regras:
 *  - Segredos JAMAIS são importados por código de cliente. Este módulo é
 *    server-only; qualquer import acidental em componente cliente quebra o build.
 *  - Em produção, valores default inseguros são rejeitados na inicialização.
 */
import 'server-only';

function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Variável de ambiente obrigatória ausente: ${key}`);
  }
  return value;
}

function bool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === '1';
}

function int(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

const INSECURE_DEFAULT_SECRET =
  'troque-este-valor-por-uma-chave-aleatoria-de-32-bytes-ou-mais';

const authSecret = required(
  'AUTH_SECRET',
  isProduction ? undefined : INSECURE_DEFAULT_SECRET,
);

if (isProduction && (authSecret === INSECURE_DEFAULT_SECRET || authSecret.length < 32)) {
  throw new Error(
    'AUTH_SECRET inseguro em produção. Gere um valor com: openssl rand -base64 48',
  );
}

export const env = {
  nodeEnv,
  isProduction,
  isDevelopment: nodeEnv === 'development',

  databaseUrl: required('DATABASE_URL'),
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  appName: process.env.APP_NAME ?? 'Nexora',

  authSecret,
  sessionTtlDays: int('SESSION_TTL_DAYS', 30),

  storage: {
    driver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3',
    localPath: process.env.STORAGE_LOCAL_PATH ?? './storage/uploads',
    maxFileMb: int('STORAGE_MAX_FILE_MB', 25),
    s3: {
      endpoint: process.env.S3_ENDPOINT ?? '',
      region: process.env.S3_REGION ?? '',
      bucket: process.env.S3_BUCKET ?? '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    },
  },

  mail: {
    driver: (process.env.MAIL_DRIVER ?? 'console') as 'console' | 'smtp',
    from: process.env.MAIL_FROM ?? 'Nexora <nao-responda@nexora.app>',
    smtp: {
      host: process.env.SMTP_HOST ?? '',
      port: int('SMTP_PORT', 587),
      user: process.env.SMTP_USER ?? '',
      password: process.env.SMTP_PASSWORD ?? '',
    },
  },

  ai: {
    provider: (process.env.AI_PROVIDER ?? 'heuristic') as 'heuristic' | 'anthropic',
    model: process.env.AI_MODEL ?? 'claude-sonnet-5',
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
  },

  billing: {
    provider: (process.env.BILLING_PROVIDER ?? 'manual') as 'manual' | 'stripe',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  },

  rateLimitEnabled: bool('RATE_LIMIT_ENABLED', true),
} as const;
