# ─────────────────────────────────────────────────────────────────────────────
# Nexora — imagem de produção
#
# Build multi-estágio: a imagem final não carrega toolchain, código-fonte nem
# dependências de desenvolvimento. Roda como usuário sem privilégios.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ── Dependências ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ── Build ────────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# O cliente Prisma é gerado a partir do schema antes do build do Next.
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
# AUTH_SECRET e DATABASE_URL de build são descartáveis: a validação de
# ambiente exige que existam, mas os valores reais chegam em tempo de execução.
ENV AUTH_SECRET="valor-de-build-descartado-em-runtime-com-32-bytes"
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nexora

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nexora:nodejs /app/.next ./.next
COPY --from=builder --chown=nexora:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nexora:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nexora:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nexora:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nexora:nodejs /app/src/generated ./src/generated

# Diretório de uploads do driver local (em produção, prefira S3).
RUN mkdir -p /app/storage/uploads && chown -R nexora:nodejs /app/storage

USER nexora
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start"]
