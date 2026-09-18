import Link from 'next/link';
import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { requireAuth } from '@/lib/auth/context';
import { getOrgChart, type OrgNode } from '@/server/services/members.service';
import { listDepartments } from '@/server/services/org.service';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/misc';

export const metadata: Metadata = { title: 'Organograma' };

export default async function OrgChartPage() {
  const ctx = await requireAuth();

  const [roots, departments] = await Promise.all([
    getOrgChart(ctx),
    ctx.can('departments.view') ? listDepartments(ctx) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Estrutura da empresa"
        description="Visualize a hierarquia e a organização da sua equipe."
      />

      <PageBody className="space-y-6">
        {roots.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Building2 className="size-5" />}
              title="Organograma vazio"
              description="Defina o gestor de cada pessoa em Funcionários para montar a hierarquia."
            />
          </Card>
        ) : (
          <Card className="relative overflow-x-auto p-6">
            <div className="flex min-w-max justify-center">
              <ul className="flex gap-6">
                {roots.map((node) => (
                  <OrgBranch key={node.id} node={node} />
                ))}
              </ul>
            </div>
          </Card>
        )}

        {departments.length > 0 ? (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-ink">Departamentos</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {departments.map((department) => (
                <Card key={department.id} className="p-4">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: department.color }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{department.name}</p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {department._count.members} {department._count.members === 1 ? 'pessoa' : 'pessoas'}
                        {department._count.groups > 0 ? ` · ${department._count.groups} equipes` : ''}
                      </p>
                      {department.lead ? (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-subtle">
                          <Avatar
                            name={department.lead.user.name}
                            src={department.lead.user.avatarUrl}
                            id={department.lead.id}
                            size="xs"
                          />
                          {department.lead.user.name}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ) : null}
      </PageBody>
    </>
  );
}

/** Nó recursivo do organograma, com conectores desenhados em CSS. */
function OrgBranch({ node }: { node: OrgNode }) {
  return (
    <li className="flex flex-col items-center">
      <Link
        href={`/funcionarios/${node.id}`}
        className="flex w-44 flex-col items-center gap-2 rounded-xl border border-line bg-surface-raised p-3 text-center transition-colors hover:border-brand/40"
      >
        <Avatar name={node.name} src={node.avatarUrl} id={node.id} size="md" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{node.name}</span>
          <span className="mt-0.5 block truncate text-xs" style={{ color: node.roleColor }}>
            {node.jobTitle ?? node.roleName}
          </span>
          {node.departmentName ? (
            <span className="mt-0.5 block truncate text-[11px] text-ink-faint">{node.departmentName}</span>
          ) : null}
        </span>
      </Link>

      {node.children.length > 0 ? (
        <>
          <span className="h-6 w-px bg-line" aria-hidden />
          <ul className="relative flex gap-5">
            {node.children.length > 1 ? (
              <span className="absolute top-0 right-[calc(50%/var(--count))] left-[calc(50%/var(--count))] h-px bg-line" aria-hidden />
            ) : null}
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <span className="h-5 w-px bg-line" aria-hidden />
                <ul>
                  <OrgBranch node={child} />
                </ul>
              </div>
            ))}
          </ul>
        </>
      ) : null}
    </li>
  );
}
