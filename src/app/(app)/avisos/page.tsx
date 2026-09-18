import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/context';
import { listAnnouncements } from '@/server/services/announcements.service';
import { listDepartments, listGroups } from '@/server/services/org.service';
import { listRoles } from '@/server/services/roles.service';
import { AnnouncementsBoard } from './announcements-board';

export const metadata: Metadata = { title: 'Avisos' };

export default async function AnnouncementsPage() {
  const ctx = await requireAuth();
  const canPublish = ctx.can('announcements.publish');

  const [announcements, departments, groups, roles] = await Promise.all([
    listAnnouncements(ctx),
    canPublish && ctx.can('departments.view') ? listDepartments(ctx) : Promise.resolve([]),
    canPublish && ctx.can('groups.view') ? listGroups(ctx) : Promise.resolve([]),
    canPublish && ctx.can('roles.view') ? listRoles(ctx) : Promise.resolve([]),
  ]);

  return (
    <AnnouncementsBoard
      initialAnnouncements={announcements.map((announcement) => ({
        id: announcement.id,
        title: announcement.title,
        body: announcement.body,
        severity: announcement.severity,
        audience: announcement.audience,
        pinned: announcement.pinned,
        isRead: announcement.isRead,
        publishedAt: announcement.publishedAt ? announcement.publishedAt.toISOString() : null,
        authorName: announcement.author.user.name,
        authorAvatar: announcement.author.user.avatarUrl,
        authorRole: announcement.author.role?.name ?? null,
        targetName: announcement.department?.name ?? announcement.group?.name ?? null,
      }))}
      departments={departments.map((department) => ({ id: department.id, name: department.name }))}
      groups={groups.map((group) => ({ id: group.id, name: group.name }))}
      roles={roles.map((role) => ({ id: role.id, name: role.name }))}
      canPublish={canPublish}
    />
  );
}
