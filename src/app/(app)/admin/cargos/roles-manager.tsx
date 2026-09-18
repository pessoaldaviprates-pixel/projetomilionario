'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Shield, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/misc';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { pluralize } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export interface RoleDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  permissions: string[];
  rank: number;
  isActive: boolean;
  isSystem: boolean;
  isDefault: boolean;
  memberCount: number;
}

export interface PermissionGroupDto {
  key: string;
  label: string;
  permissions: { key: string; label: string }[];
}

const COLORS = ['#2E7DFF', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#F97316', '#94A3B8'];

export function RolesManager({
  initialRoles,
  permissionGroups,
  canManage,
  canManagePermissions,
}: {
  initialRoles: RoleDto[];
  permissionGroups: PermissionGroupDto[];
  canManage: boolean;
  canManagePermissions: boolean;
}) {
  const [roles, setRoles] = useState(initialRoles);
  const [selectedId, setSelectedId] = useState(initialRoles[0]?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newColor, setNewColor] = useState(COLORS[0]!);
  const [activeGroup, setActiveGroup] = useState(permissionGroups[0]?.key ?? '');
  const router = useRouter();

  const selected = roles.find((role) => role.id === selectedId) ?? null;
  const group = permissionGroups.find((entry) => entry.key === activeGroup) ?? permissionGroups[0];

  async function togglePermission(permission: string, granted: boolean) {
    if (!selected || !canManagePermissions) return;

    const nextPermissions = granted
      ? Array.from(new Set([...selected.permissions, permission]))
      : selected.permissions.filter((item) => item !== permission);

    const previous = roles;
    setRoles((current) =>
      current.map((role) => (role.id === selected.id ? { ...role, permissions: nextPermissions } : role)),
    );
    setSaving(true);

    try {
      const response = await fetch(`/api/cargos/${selected.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ permissions: nextPermissions }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Não foi possível salvar.');
      }

      router.refresh();
    } catch (error) {
      setRoles(previous);
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(role: RoleDto) {
    const previous = roles;
    setRoles((current) =>
      current.map((item) => (item.id === role.id ? { ...item, isActive: !item.isActive } : item)),
    );

    try {
      const response = await fetch(`/api/cargos/${role.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: !role.isActive }),
      });
      if (!response.ok) throw new Error('falha');

      toast.success(
        role.isActive
          ? `Cargo "${role.name}" desativado. Quem o possui perde as permissões dele.`
          : `Cargo "${role.name}" reativado.`,
      );
      router.refresh();
    } catch {
      setRoles(previous);
      toast.error('Não foi possível alterar o cargo.');
    }
  }

  async function create(formData: FormData) {
    setPending(true);
    try {
      const response = await fetch('/api/cargos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: String(formData.get('name') ?? ''),
          description: String(formData.get('description') ?? '') || undefined,
          color: newColor,
          // Cargo novo nasce sem permissão: o administrador concede o que quiser.
          permissions: [],
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? 'Não foi possível criar o cargo.');

      toast.success('Cargo criado. Defina as permissões ao lado.');
      setCreateOpen(false);
      setSelectedId(json.data.id);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setPending(false);
    }
  }

  async function remove(role: RoleDto) {
    if (role.memberCount > 0) {
      toast.error(
        `${pluralize(role.memberCount, 'pessoa usa', 'pessoas usam')} este cargo. Mova-as antes de excluir.`,
      );
      return;
    }

    const previous = roles;
    setRoles((current) => current.filter((item) => item.id !== role.id));
    if (selectedId === role.id) setSelectedId(previous[0]?.id ?? null);

    try {
      const response = await fetch(`/api/cargos/${role.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Não foi possível excluir.');
      }
      toast.success('Cargo excluído.');
      router.refresh();
    } catch (error) {
      setRoles(previous);
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    }
  }

  return (
    <>
      <PageHeader
        title="Cargos e permissões"
        description="Defina exatamente o que cada cargo pode fazer no sistema."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden /> Novo cargo
            </Button>
          ) : null
        }
      />

      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          {/* ── Lista de cargos ─────────────────────────────────────── */}
          <Card className="h-fit overflow-hidden p-0">
            <div className="border-b border-line px-4 py-3">
              <p className="text-xs font-semibold text-ink">
                {roles.length} {roles.length === 1 ? 'cargo' : 'cargos'}
              </p>
            </div>

            <ul className="max-h-[560px] divide-y divide-line overflow-y-auto scrollbar-thin">
              {roles.map((role) => (
                <li key={role.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(role.id)}
                    aria-current={selectedId === role.id ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors',
                      selectedId === role.id ? 'bg-brand/[0.08]' : 'hover:bg-surface-overlay',
                    )}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: role.color, opacity: role.isActive ? 1 : 0.35 }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-sm', role.isActive ? 'text-ink' : 'text-ink-faint')}>
                        {role.name}
                      </span>
                      <span className="block text-xs text-ink-faint">
                        {pluralize(role.memberCount, 'pessoa', 'pessoas')} · {role.permissions.length} permissões
                      </span>
                    </span>
                    {role.isDefault ? <Badge tone="brand">Padrão</Badge> : null}
                    {!role.isActive ? <Badge>Inativo</Badge> : null}
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {/* ── Permissões do cargo selecionado ──────────────────────── */}
          {selected ? (
            <Card className="overflow-hidden p-0">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="size-3 rounded-full" style={{ backgroundColor: selected.color }} aria-hidden />
                    <h2 className="text-base font-semibold text-ink">{selected.name}</h2>
                    {selected.isSystem ? <Badge>Padrão do sistema</Badge> : null}
                  </div>
                  {selected.description ? (
                    <p className="mt-1 text-sm text-ink-subtle">{selected.description}</p>
                  ) : null}
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
                    <Users className="size-3.5" aria-hidden />
                    {pluralize(selected.memberCount, 'pessoa com este cargo', 'pessoas com este cargo')}
                  </p>
                </div>

                {canManage ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => toggleActive(selected)}>
                      {selected.isActive ? 'Desativar' : 'Reativar'}
                    </Button>
                    {!selected.isDefault ? (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => remove(selected)}
                        aria-label={`Excluir cargo ${selected.name}`}
                        className="text-ink-faint hover:text-danger"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 scrollbar-thin" role="tablist" aria-label="Grupos de permissão">
                {permissionGroups.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    role="tab"
                    aria-selected={activeGroup === entry.key}
                    onClick={() => setActiveGroup(entry.key)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                      activeGroup === entry.key
                        ? 'bg-surface-overlay text-ink'
                        : 'text-ink-subtle hover:bg-surface-overlay hover:text-ink',
                    )}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {!canManagePermissions ? (
                  <p className="mb-4 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-ink-subtle">
                    Você pode visualizar as permissões, mas alterá-las exige a permissão
                    “Definir permissões dos cargos”.
                  </p>
                ) : null}

                <ul className="grid gap-2 sm:grid-cols-2">
                  {group?.permissions.map((permission) => {
                    const granted = selected.permissions.includes(permission.key);

                    return (
                      <li key={permission.key}>
                        <label
                          className={cn(
                            'flex items-start gap-2.5 rounded-xl border p-3 transition-colors',
                            granted ? 'border-brand/30 bg-brand/[0.05]' : 'border-line',
                            canManagePermissions ? 'cursor-pointer hover:border-line-strong' : 'cursor-default',
                          )}
                        >
                          <Checkbox
                            checked={granted}
                            disabled={!canManagePermissions || saving}
                            onCheckedChange={(checked) => togglePermission(permission.key, checked === true)}
                            className="mt-0.5"
                          />
                          <span className="min-w-0">
                            <span className={cn('block text-sm', granted ? 'text-ink' : 'text-ink-muted')}>
                              {permission.label}
                            </span>
                            <span className="mt-0.5 block font-mono text-[10px] text-ink-faint">
                              {permission.key}
                            </span>
                          </span>
                          {granted ? <Check className="ml-auto size-3.5 shrink-0 text-brand" aria-hidden /> : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Card>
          ) : (
            <Card className="flex items-center justify-center p-10">
              <p className="text-sm text-ink-faint">Selecione um cargo para ver as permissões.</p>
            </Card>
          )}
        </div>
      </PageBody>

      {canManage ? (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent title="Novo cargo" description="O cargo nasce sem permissões — você concede o que quiser em seguida." size="sm">
            <form action={create} className="space-y-4">
              <Input name="name" label="Nome do cargo" placeholder="ex.: Analista de dados" required autoFocus maxLength={60} />
              <Textarea name="description" label="Descrição (opcional)" className="min-h-16" maxLength={240} />

              <fieldset>
                <legend className="mb-2 text-xs font-medium text-ink-muted">Cor</legend>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setNewColor(option)}
                      aria-label={`Cor ${option}`}
                      aria-pressed={newColor === option}
                      className={`size-7 rounded-lg transition-transform ${newColor === option ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface-raised' : ''}`}
                      style={{ backgroundColor: option }}
                    />
                  ))}
                </div>
              </fieldset>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" loading={pending}>Criar cargo</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
