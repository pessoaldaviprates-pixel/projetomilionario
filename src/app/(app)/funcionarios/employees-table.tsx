'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Search, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import {
  Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger,
} from '@/components/ui/dropdown';
import { InviteDialog } from './invite-dialog';

export interface EmployeeRow {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  status: string;
  presence: string;
  isOwner: boolean;
  roleId: string;
  roleName: string;
  roleColor: string;
  departmentId: string | null;
  departmentName: string | null;
  openTasks: number;
  projects: number;
}

const STATUS_META: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' | 'danger' }> = {
  ACTIVE: { label: 'Ativo', tone: 'success' },
  INVITED: { label: 'Convidado', tone: 'warning' },
  SUSPENDED: { label: 'Suspenso', tone: 'danger' },
  DEACTIVATED: { label: 'Inativo', tone: 'neutral' },
};

export function EmployeesTable({
  members,
  roles,
  departments,
  canInvite,
  canUpdate,
  canAssignRole,
  canDeactivate,
}: {
  members: EmployeeRow[];
  roles: { id: string; name: string; color: string }[];
  departments: { id: string; name: string }[];
  canInvite: boolean;
  canUpdate: boolean;
  canAssignRole: boolean;
  canDeactivate: boolean;
}) {
  const [rows, setRows] = useState(members);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const router = useRouter();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (departmentFilter && row.departmentId !== departmentFilter) return false;
      if (!term) return true;
      return (
        row.name.toLowerCase().includes(term) ||
        row.email.toLowerCase().includes(term) ||
        (row.jobTitle ?? '').toLowerCase().includes(term)
      );
    });
  }, [rows, search, departmentFilter]);

  async function patchMember(id: string, payload: Record<string, unknown>, optimistic: Partial<EmployeeRow>) {
    const previous = rows;
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...optimistic } : row)));

    try {
      const response = await fetch(`/api/funcionarios/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Não foi possível atualizar.');
      }

      toast.success('Funcionário atualizado.');
      router.refresh();
    } catch (error) {
      setRows(previous);
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    }
  }

  return (
    <>
      <PageHeader
        title="Funcionários"
        description="Gerencie sua equipe, cargos e departamentos."
        actions={
          canInvite ? (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="size-4" aria-hidden /> Convidar pessoa
            </Button>
          ) : null
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar funcionário…"
              aria-label="Buscar funcionário"
              className="h-9 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-ink-faint focus:border-brand/60 focus:outline-none"
            />
          </div>

          {departments.length > 0 ? (
            <select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              aria-label="Filtrar por departamento"
              className="h-9 rounded-xl border border-line bg-surface px-3 text-xs text-ink-muted focus:border-brand/60 focus:outline-none"
            >
              <option value="">Todos os departamentos</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
          ) : null}
        </div>
      </PageHeader>

      <PageBody>
        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users className="size-5" />}
              title="Nenhum funcionário encontrado"
              description={search ? 'Ajuste a busca para ver mais resultados.' : 'Convide as primeiras pessoas para a empresa.'}
              action={
                canInvite ? (
                  <Button size="sm" onClick={() => setInviteOpen(true)}>
                    <UserPlus className="size-4" aria-hidden /> Convidar pessoa
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px]">
              <caption className="sr-only">Funcionários da empresa</caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium text-ink-faint">Nome</th>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium text-ink-faint">Cargo</th>
                  <th scope="col" className="hidden px-4 py-2.5 text-xs font-medium text-ink-faint lg:table-cell">Departamento</th>
                  <th scope="col" className="hidden px-4 py-2.5 text-xs font-medium text-ink-faint xl:table-cell">Tarefas</th>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium text-ink-faint">Status</th>
                  <th scope="col" className="w-10 px-4 py-2.5"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {filtered.map((member) => {
                  const status = STATUS_META[member.status] ?? STATUS_META.ACTIVE!;

                  return (
                    <tr key={member.id} className="transition-colors hover:bg-surface-overlay">
                      <td className="px-4 py-2.5">
                        <Link href={`/funcionarios/${member.id}`} className="flex min-w-0 items-center gap-2.5">
                          <Avatar
                            name={member.name}
                            src={member.avatarUrl}
                            id={member.id}
                            size="sm"
                            presence={member.presence as 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE'}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-ink">{member.name}</span>
                            <span className="block truncate text-xs text-ink-faint">{member.email}</span>
                          </span>
                        </Link>
                      </td>

                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: member.roleColor }} aria-hidden />
                          <span className="text-sm text-ink-muted">{member.roleName}</span>
                          {member.isOwner ? <Badge tone="brand">Dono</Badge> : null}
                        </span>
                      </td>

                      <td className="hidden px-4 py-2.5 text-sm text-ink-subtle lg:table-cell">
                        {member.departmentName ?? '—'}
                      </td>

                      <td className="hidden px-4 py-2.5 text-sm text-ink-subtle tabular-nums xl:table-cell">
                        {member.openTasks}
                      </td>

                      <td className="px-4 py-2.5">
                        <Badge tone={status.tone} dot>{status.label}</Badge>
                      </td>

                      <td className="px-4 py-2.5">
                        {(canUpdate || canAssignRole || canDeactivate) && !member.isOwner ? (
                          <Dropdown>
                            <DropdownTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Ações para ${member.name}`}
                                className="rounded p-1.5 text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
                              >
                                <MoreHorizontal className="size-4" aria-hidden />
                              </button>
                            </DropdownTrigger>

                            <DropdownContent className="w-56">
                              <DropdownItem asChild>
                                <Link href={`/funcionarios/${member.id}`}>Ver perfil</Link>
                              </DropdownItem>

                              {canAssignRole && roles.length > 0 ? (
                                <>
                                  <DropdownSeparator />
                                  <DropdownLabel>Alterar cargo</DropdownLabel>
                                  {roles.slice(0, 8).map((role) => (
                                    <DropdownItem
                                      key={role.id}
                                      disabled={role.id === member.roleId}
                                      onSelect={() =>
                                        patchMember(member.id, { roleId: role.id }, {
                                          roleId: role.id,
                                          roleName: role.name,
                                          roleColor: role.color,
                                        })
                                      }
                                    >
                                      <span className="size-2 rounded-full" style={{ backgroundColor: role.color }} aria-hidden />
                                      {role.name}
                                    </DropdownItem>
                                  ))}
                                </>
                              ) : null}

                              {canDeactivate ? (
                                <>
                                  <DropdownSeparator />
                                  {member.status === 'ACTIVE' ? (
                                    <DropdownItem
                                      danger
                                      onSelect={() =>
                                        patchMember(member.id, { status: 'DEACTIVATED' }, { status: 'DEACTIVATED' })
                                      }
                                    >
                                      Desativar acesso
                                    </DropdownItem>
                                  ) : (
                                    <DropdownItem
                                      onSelect={() => patchMember(member.id, { status: 'ACTIVE' }, { status: 'ACTIVE' })}
                                    >
                                      Reativar acesso
                                    </DropdownItem>
                                  )}
                                </>
                              ) : null}
                            </DropdownContent>
                          </Dropdown>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </PageBody>

      {canInvite ? <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} roles={roles} /> : null}
    </>
  );
}
