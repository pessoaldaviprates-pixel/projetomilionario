import type { Metadata } from 'next';
import { Mail, Shield, ShieldCheck } from 'lucide-react';
import { requireAuth } from '@/lib/auth/context';
import { prisma } from '@/lib/db/prisma';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { PERMISSIONS, type Permission } from '@/lib/authz/permissions';
import { formatDateTime, formatRelative } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Meu perfil' };

export default async function ProfilePage() {
  const ctx = await requireAuth();

  const sessions = await prisma.session.findMany({
    where: { userId: ctx.userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastActivityAt: 'desc' },
    take: 10,
    select: { id: true, ipAddress: true, userAgent: true, lastActivityAt: true, createdAt: true },
  });

  const permissions = Array.from(ctx.permissions) as Permission[];

  return (
    <>
      <PageHeader title="Meu perfil" description="Seus dados, acessos e sessões ativas." />

      <PageBody className="space-y-5">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center">
            <Avatar name={ctx.user.name} src={ctx.user.avatarUrl} id={ctx.membershipId} size="xl" />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-ink">{ctx.user.name}</h2>
                <Badge style={{ color: ctx.role.color }}>{ctx.role.name}</Badge>
                {ctx.isOwner ? <Badge tone="brand">Proprietário</Badge> : null}
              </div>

              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                <Mail className="size-3.5 text-ink-faint" aria-hidden /> {ctx.user.email}
                {ctx.user.emailVerifiedAt ? (
                  <Badge tone="success">Verificado</Badge>
                ) : (
                  <Badge tone="warning">Não verificado</Badge>
                )}
              </p>

              <p className="mt-1 text-xs text-ink-faint">
                {ctx.company.name} · fuso {ctx.user.timezone}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4" aria-hidden /> Suas permissões
            </CardTitle>
            <span className="text-xs text-ink-faint">{permissions.length} permissões</span>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {permissions.map((permission) => (
                <li key={permission} className="flex items-start gap-2 text-xs text-ink-subtle">
                  <Shield className="mt-0.5 size-3 shrink-0 text-success" aria-hidden />
                  {PERMISSIONS[permission]}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="overflow-hidden p-0">
          <CardHeader>
            <CardTitle>Sessões ativas</CardTitle>
            <span className="text-xs text-ink-faint">{sessions.length} dispositivos</span>
          </CardHeader>

          <ul className="divide-y divide-line border-t border-line">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink-muted">
                    {session.userAgent?.slice(0, 70) ?? 'Dispositivo desconhecido'}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {session.ipAddress ? `IP ${session.ipAddress} · ` : ''}
                    Última atividade {formatRelative(session.lastActivityAt)}
                  </p>
                </div>
                {session.id === ctx.sessionId ? <Badge tone="success">Esta sessão</Badge> : null}
              </li>
            ))}
          </ul>

          <p className="border-t border-line px-5 py-3 text-xs text-ink-faint">
            Trocar a senha encerra todas as outras sessões automaticamente.
          </p>
        </Card>
      </PageBody>
    </>
  );
}
