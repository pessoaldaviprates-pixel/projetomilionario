import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/context';
import { listRoles } from '@/server/services/roles.service';
import { PERMISSION_GROUPS, PERMISSIONS } from '@/lib/authz/permissions';
import { RolesManager } from './roles-manager';

export const metadata: Metadata = { title: 'Cargos e permissões' };

export default async function RolesPage() {
  const ctx = await requirePermission('roles.view');
  const roles = await listRoles(ctx);

  return (
    <RolesManager
      initialRoles={roles}
      permissionGroups={PERMISSION_GROUPS.map((group) => ({
        key: group.key,
        label: group.label,
        permissions: group.permissions.map((permission) => ({
          key: permission,
          label: PERMISSIONS[permission],
        })),
      }))}
      canManage={ctx.can('roles.manage')}
      canManagePermissions={ctx.can('permissions.manage')}
    />
  );
}
