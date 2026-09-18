import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, Building2, CheckCircle2, ListTodo, Mail, Network, Phone } from 'lucide-react';
import { requireAuth } from '@/lib/auth/context';
import { getMember } from '@/server/services/members.service';
import { NotFoundError } from '@/lib/http/errors';
import { PageBody } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/misc';
import { PERMISSIONS, type Permission } from '@/lib/authz/permissions';
import { formatDate, formatRelative } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Funcionário' };

const STATUS_META: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' | 'danger' }> = {
  ACTIVE: { label: 'Ativo', tone: 'success' },
  INVITED: { label: 'Convidado', tone: 'warning' },
  SUSPENDED: { label: 'Suspenso', tone: 'danger' },
  DEACTIVATED: { label: 'Inativo', tone: 'neutral' },
};

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth();
  const { id } = await params;

  let member;
  try {
    member = await getMember(ctx, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const status = STATUS_META[member.status] ?? STATUS_META.ACTIVE!;
  const permissions = member.role.permissions as Permission[];

  return (
    <>
      <div className="border-b border-line px-4 py-4 sm:px-6">
        <Link
          href="/funcionarios"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-subtle transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Voltar para funcionários
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar
            name={member.user.name}
            src={member.user.avatarUrl}
            id={member.id}
            size="xl"
            presence={member.presence as 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE'}
          />

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-ink">{member.user.name}</h1>
              <Badge tone={status.tone} dot>{status.label}</Badge>
              {member.isOwner ? <Badge tone="brand">Proprietário</Badge> : null}
            </div>

            <p className="text-sm text-ink-muted">
              {member.jobTitle ?? member.role.name}
              {member.department ? ` · ${member.department.name}` : ''}
            </p>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-subtle">
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5 text-ink-faint" aria-hidden /> {member.user.email}
              </span>
              {member.user.phone ? (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5 text-ink-faint" aria-hidden /> {member.user.phone}
                </span>
              ) : null}
              <span>Na empresa desde {formatDate(member.joinedAt, { month: 'long', year: 'numeric' })}</span>
              {member.user.lastLoginAt ? (
                <span>Último acesso {formatRelative(member.user.lastLoginAt)}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="p-4">
                <ListTodo className="mb-2 size-4 text-brand" aria-hidden />
                <p className="text-xl font-semibold text-ink tabular-nums">{member.stats.openTasks}</p>
                <p className="text-xs text-ink-subtle">Tarefas abertas</p>
              </Card>
              <Card className="p-4">
                <CheckCircle2 className="mb-2 size-4 text-success" aria-hidden />
                <p className="text-xl font-semibold text-ink tabular-nums">{member.stats.completedTasks}</p>
                <p className="text-xs text-ink-subtle">Tarefas concluídas</p>
              </Card>
              <Card className="p-4">
                <Building2 className="mb-2 size-4 text-accent" aria-hidden />
                <p className="text-xl font-semibold text-ink tabular-nums">{member.projectMemberships.length}</p>
                <p className="text-xs text-ink-subtle">Projetos</p>
              </Card>
            </div>

            {member.projectMemberships.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Projetos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {member.projectMemberships.map(({ project }) => (
                    <Link key={project.id} href={`/projetos/${project.id}`} className="block space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} aria-hidden />
                          <span className="truncate text-sm text-ink-muted">{project.name}</span>
                        </span>
                        <span className="shrink-0 text-xs text-ink-faint tabular-nums">{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} />
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {ctx.can('roles.view') ? (
              <Card>
                <CardHeader>
                  <CardTitle>Permissões do cargo {member.role.name}</CardTitle>
                  <span className="text-xs text-ink-faint">{permissions.length} permissões</span>
                </CardHeader>
                <CardContent>
                  {member.isOwner ? (
                    <p className="text-sm text-ink-subtle">
                      Como proprietário da empresa, esta pessoa tem acesso completo ao sistema.
                    </p>
                  ) : (
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {permissions.slice(0, 16).map((permission) => (
                        <li key={permission} className="flex items-center gap-2 text-xs text-ink-subtle">
                          <CheckCircle2 className="size-3 shrink-0 text-success" aria-hidden />
                          {PERMISSIONS[permission] ?? permission}
                        </li>
                      ))}
                      {permissions.length > 16 ? (
                        <li className="text-xs text-ink-faint">+{permissions.length - 16} outras permissões</li>
                      ) : null}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <aside className="space-y-4">
            {member.manager ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="size-4" aria-hidden /> Gestor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Link href={`/funcionarios/${member.manager.id}`} className="flex items-center gap-2.5">
                    <Avatar
                      name={member.manager.user.name}
                      src={member.manager.user.avatarUrl}
                      id={member.manager.id}
                      size="sm"
                    />
                    <span className="truncate text-sm text-ink-muted">{member.manager.user.name}</span>
                  </Link>
                </CardContent>
              </Card>
            ) : null}

            {member.reports.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Equipe ({member.reports.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {member.reports.map((report) => (
                    <Link key={report.id} href={`/funcionarios/${report.id}`} className="flex items-center gap-2.5">
                      <Avatar name={report.user.name} src={report.user.avatarUrl} id={report.id} size="xs" />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">{report.user.name}</span>
                      <span className="shrink-0 text-xs text-ink-faint">{report.role.name}</span>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </aside>
        </div>
      </PageBody>
    </>
  );
}
