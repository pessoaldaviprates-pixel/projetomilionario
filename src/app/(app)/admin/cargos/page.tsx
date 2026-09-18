import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/context';
import { listRoles } from '@/server/services/roles.service';
import { PERMISSION_GROUPS, PERMISSIONS } from '@/lib/authz/permissions';
import { RolesManager } from './roles-manager';

export const metadata: Metadata = { title: 'Cargos e permissões' };

export default async function RolesPage() {
  // Gerir cargos é ação administrativa. Quem tem apenas `roles.view` continua
  // enxergando cargo e permissões no perfil das pessoas, mas não este painel.
  const ctx = await requirePermission('roles.manage');
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
