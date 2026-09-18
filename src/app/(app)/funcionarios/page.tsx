import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/context';
import { listMembers } from '@/server/services/members.service';
import { listRoles } from '@/server/services/roles.service';
import { listDepartments } from '@/server/services/org.service';
import { EmployeesTable } from './employees-table';

export const metadata: Metadata = { title: 'Funcionários' };

export default async function EmployeesPage() {
  const ctx = await requireAuth();

  const [members, roles, departments] = await Promise.all([
    listMembers(ctx),
    ctx.can('roles.view') ? listRoles(ctx) : Promise.resolve([]),
    ctx.can('departments.view') ? listDepartments(ctx) : Promise.resolve([]),
  ]);

  return (
    <EmployeesTable
      members={members.map((member) => ({
        id: member.id,
        name: member.user.name,
        email: member.user.email,
        avatarUrl: member.user.avatarUrl,
        jobTitle: member.jobTitle,
        status: member.status,
        presence: member.presence,
        isOwner: member.isOwner,
        roleId: member.role.id,
        roleName: member.role.name,
        roleColor: member.role.color,
        departmentId: member.department?.id ?? null,
        departmentName: member.department?.name ?? null,
        openTasks: member._count.assignedTasks,
        projects: member._count.projectMemberships,
      }))}
      roles={roles.map((role) => ({ id: role.id, name: role.name, color: role.color }))}
      departments={departments.map((department) => ({ id: department.id, name: department.name }))}
      canInvite={ctx.can('users.invite')}
      canUpdate={ctx.can('users.update')}
      canAssignRole={ctx.can('roles.assign')}
      canDeactivate={ctx.can('users.deactivate')}
    />
  );
}
