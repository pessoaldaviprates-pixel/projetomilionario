import type { Metadata } from 'next';
import { AlertTriangle, Info, Shield, ShieldAlert } from 'lucide-react';
import { requirePermission } from '@/lib/auth/context';
import { prisma } from '@/lib/db/prisma';
import { scoped } from '@/lib/db/tenant';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/misc';
import { ActivityLabel } from '@/components/app/activity-label';
import { formatDateTime, formatRelative } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Segurança e logs' };

const SEVERITY_META = {
  INFO: { label: 'Informação', tone: 'neutral' as const, icon: Info },
  WARNING: { label: 'Atenção', tone: 'warning' as const, icon: AlertTriangle },
  CRITICAL: { label: 'Crítico', tone: 'danger' as const, icon: ShieldAlert },
};

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ severidade?: string }>;
}) {
  const ctx = await requirePermission('audit.view');
  const params = await searchParams;

  const severityFilter =
    params.severidade === 'WARNING' || params.severidade === 'CRITICAL' ? params.severidade : undefined;

  const [logs, counts, activeSessions] = await Promise.all([
    prisma.auditLog.findMany({
      where: { ...scoped(ctx), ...(severityFilter ? { severity: severityFilter } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, action: true, entityType: true, entityId: true, severity: true,
        ipAddress: true, metadata: true, createdAt: true, actorEmail: true,
        actor: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } },
      },
    }),
    prisma.auditLog.groupBy({
      by: ['severity'],
      where: scoped(ctx),
      _count: { _all: true },
    }),
    // Sessões ativas de quem pertence a esta empresa.
    prisma.session.count({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { memberships: { some: { companyId: ctx.companyId, status: 'ACTIVE' } } },
      },
    }),
  ]);

  const countBySeverity = Object.fromEntries(counts.map((row) => [row.severity, row._count._all]));

  return (
    <>
      <PageHeader
        title="Segurança e auditoria"
        description="Trilha imutável de tudo o que acontece na empresa."
      >
        <div className="flex flex-wrap gap-1">
          <FilterLink href="/admin/seguranca" label="Todos" active={!severityFilter} />
          <FilterLink
            href="/admin/seguranca?severidade=WARNING"
            label={`Atenção (${countBySeverity.WARNING ?? 0})`}
            active={severityFilter === 'WARNING'}
          />
          <FilterLink
            href="/admin/seguranca?severidade=CRITICAL"
            label={`Críticos (${countBySeverity.CRITICAL ?? 0})`}
            active={severityFilter === 'CRITICAL'}
          />
        </div>
      </PageHeader>

      <PageBody className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="flex items-center gap-3.5 p-4">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand/12 text-brand">
              <Shield className="size-[18px]" aria-hidden />
            </span>
            <div>
              <p className="text-xl leading-none font-semibold text-ink tabular-nums">{activeSessions}</p>
              <p className="mt-1 text-sm text-ink-muted">Sessões ativas</p>
            </div>
          </Card>

          <Card className="flex items-center gap-3.5 p-4">
            <span className="flex size-9 items-center justify-center rounded-xl bg-warning/12 text-warning">
              <AlertTriangle className="size-[18px]" aria-hidden />
            </span>
            <div>
              <p className="text-xl leading-none font-semibold text-ink tabular-nums">
                {countBySeverity.WARNING ?? 0}
              </p>
              <p className="mt-1 text-sm text-ink-muted">Eventos de atenção</p>
            </div>
          </Card>

          <Card className="flex items-center gap-3.5 p-4">
            <span className="flex size-9 items-center justify-center rounded-xl bg-danger/12 text-danger">
              <ShieldAlert className="size-[18px]" aria-hidden />
            </span>
            <div>
              <p className="text-xl leading-none font-semibold text-ink tabular-nums">
                {countBySeverity.CRITICAL ?? 0}
              </p>
              <p className="mt-1 text-sm text-ink-muted">Eventos críticos</p>
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden p-0">
          <CardHeader>
            <CardTitle>Registro de auditoria</CardTitle>
            <span className="text-xs text-ink-faint">últimos {logs.length} eventos</span>
          </CardHeader>

          {logs.length === 0 ? (
            <EmptyState
              icon={<Shield className="size-5" />}
              title="Nenhum evento registrado"
              description="Ações relevantes aparecem aqui automaticamente."
            />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {logs.map((log) => {
                const severity = SEVERITY_META[log.severity];
                const Icon = severity.icon;

                return (
                  <li key={log.id} className="flex items-start gap-3 px-5 py-3">
                    <Icon
                      className={`mt-0.5 size-4 shrink-0 ${
                        log.severity === 'CRITICAL'
                          ? 'text-danger'
                          : log.severity === 'WARNING'
                            ? 'text-warning'
                            : 'text-ink-faint'
                      }`}
                      aria-hidden
                    />

                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                        {log.actor ? (
                          <Avatar name={log.actor.user.name} src={log.actor.user.avatarUrl} id={log.actor.id} size="xs" />
                        ) : null}
                        <span className="font-medium text-ink">
                          {log.actor?.user.name ?? log.actorEmail ?? 'Sistema'}
                        </span>
                        <ActivityLabel action={log.action} metadata={log.metadata} />
                      </p>

                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-faint">
                        <span title={formatDateTime(log.createdAt)}>{formatRelative(log.createdAt)}</span>
                        <span className="font-mono">{log.action}</span>
                        {log.ipAddress ? <span>IP {log.ipAddress}</span> : null}
                      </p>
                    </div>

                    <Badge tone={severity.tone}>{severity.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Práticas de segurança aplicadas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {[
                'Isolamento total de dados entre empresas',
                'Senhas com hash bcrypt (custo 12)',
                'Sessões revogáveis, com hash no banco',
                'Autorização verificada no servidor em toda ação',
                'Rate limiting em login, upload e IA',
                'Upload com allowlist de tipo e bloqueio de executáveis',
                'Download autenticado, sem URL pública',
                'Trilha de auditoria imutável',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-ink-subtle">
                  <Shield className="mt-0.5 size-3 shrink-0 text-success" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-surface-overlay text-ink' : 'text-ink-subtle hover:bg-surface-overlay hover:text-ink'
      }`}
    >
      {label}
    </a>
  );
}
