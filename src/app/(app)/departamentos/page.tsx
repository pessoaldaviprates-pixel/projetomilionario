import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/context';
import { listDepartments } from '@/server/services/org.service';
import { listMemberOptions } from '@/server/services/members.service';
import { DepartmentsManager } from './departments-manager';

export const metadata: Metadata = { title: 'Departamentos' };

export default async function DepartmentsPage() {
  const ctx = await requireAuth();

  const [departments, members] = await Promise.all([listDepartments(ctx), listMemberOptions(ctx)]);

  return (
    <DepartmentsManager
      initialDepartments={departments.map((department) => ({
        id: department.id,
        name: department.name,
        description: department.description,
        color: department.color,
        parentId: department.parentId,
        leadName: department.lead?.user.name ?? null,
        leadId: department.lead?.id ?? null,
        leadAvatar: department.lead?.user.avatarUrl ?? null,
        memberCount: department._count.members,
        groupCount: department._count.groups,
      }))}
      members={members.map((member) => ({ id: member.id, name: member.user.name }))}
      canManage={ctx.can('departments.manage')}
    />
  );
}
