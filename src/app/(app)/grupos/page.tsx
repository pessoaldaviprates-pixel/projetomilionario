import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/context';
import { listGroups, listDepartments } from '@/server/services/org.service';
import { listMemberOptions } from '@/server/services/members.service';
import { GroupsManager } from './groups-manager';

export const metadata: Metadata = { title: 'Grupos e equipes' };

export default async function GroupsPage() {
  const ctx = await requireAuth();

  const [groups, departments, members] = await Promise.all([
    listGroups(ctx),
    ctx.can('departments.view') ? listDepartments(ctx) : Promise.resolve([]),
    listMemberOptions(ctx),
  ]);

  return (
    <GroupsManager
      initialGroups={groups.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        color: group.color,
        isPrivate: group.isPrivate,
        departmentName: group.department?.name ?? null,
        memberCount: group._count.members,
        members: group.members.map((member) => ({
          id: member.membership.id,
          name: member.membership.user.name,
          avatarUrl: member.membership.user.avatarUrl,
        })),
      }))}
      departments={departments.map((department) => ({ id: department.id, name: department.name }))}
      members={members.map((member) => ({ id: member.id, name: member.user.name }))}
      canManage={ctx.can('groups.manage')}
    />
  );
}
