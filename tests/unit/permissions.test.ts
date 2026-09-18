import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS, BASE_EMPLOYEE_PERMISSIONS, DEFAULT_ROLE_PRESETS,
  PERMISSION_GROUPS, isValidPermission, sanitizePermissions,
} from '@/lib/authz/permissions';

describe('catálogo de permissões', () => {
  it('não permite gravar permissão inventada', () => {
    const cleaned = sanitizePermissions(['tasks.view', 'permissao.inexistente', 'admin.tudo']);
    expect(cleaned).toEqual(['tasks.view']);
  });

  it('remove duplicatas', () => {
    expect(sanitizePermissions(['tasks.view', 'tasks.view'])).toHaveLength(1);
  });

  it('valida chaves conhecidas', () => {
    expect(isValidPermission('tasks.create')).toBe(true);
    expect(isValidPermission('tasks.destroy')).toBe(false);
  });

  it('todos os grupos referenciam apenas permissões existentes', () => {
    for (const group of PERMISSION_GROUPS) {
      for (const permission of group.permissions) {
        expect(ALL_PERMISSIONS).toContain(permission);
      }
    }
  });

  it('todas as permissões aparecem em algum grupo da interface', () => {
    // Uma permissão fora de grupo seria invisível na tela de cargos —
    // existiria no backend sem forma de ser concedida.
    const grouped = new Set(PERMISSION_GROUPS.flatMap((group) => group.permissions));
    const missing = ALL_PERMISSIONS.filter((permission) => !grouped.has(permission));
    expect(missing).toEqual([]);
  });
});

describe('cargos padrão', () => {
  it('todo cargo usa apenas permissões válidas', () => {
    for (const preset of DEFAULT_ROLE_PRESETS) {
      expect(sanitizePermissions(preset.permissions)).toHaveLength(
        new Set(preset.permissions).size,
      );
    }
  });

  it('existe exatamente um cargo padrão', () => {
    expect(DEFAULT_ROLE_PRESETS.filter((preset) => preset.isDefault)).toHaveLength(1);
  });

  it('slugs de cargo são únicos', () => {
    const slugs = DEFAULT_ROLE_PRESETS.map((preset) => preset.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('o CEO tem acesso completo', () => {
    const ceo = DEFAULT_ROLE_PRESETS.find((preset) => preset.slug === 'ceo');
    expect(ceo!.permissions).toHaveLength(ALL_PERMISSIONS.length);
  });

  it('cargos operacionais não recebem permissões administrativas', () => {
    const developer = DEFAULT_ROLE_PRESETS.find((preset) => preset.slug === 'desenvolvedor')!;

    for (const dangerous of ['company.delete', 'permissions.manage', 'billing.manage', 'users.delete'] as const) {
      expect(developer.permissions).not.toContain(dangerous);
    }
  });

  it('o funcionário padrão não vê dados financeiros', () => {
    expect(BASE_EMPLOYEE_PERMISSIONS).not.toContain('billing.view');
    expect(BASE_EMPLOYEE_PERMISSIONS).not.toContain('audit.view');
  });
});
