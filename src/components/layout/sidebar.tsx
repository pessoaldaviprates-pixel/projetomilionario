'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { NexoraLogo } from '@/components/brand/logo';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils/cn';
import { visibleSections, type NavSection } from './nav-config';

export interface SidebarUser {
  name: string;
  avatarUrl: string | null;
  roleName: string;
  companyName: string;
}

interface SidebarProps {
  permissions: string[];
  isOwner: boolean;
  user: SidebarUser;
  badges: { messages: number; notifications: number };
  /** Controlado apenas no mobile; no desktop a sidebar é sempre visível. */
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ permissions, isOwner, user, badges, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const sections = visibleSections(new Set(permissions), isOwner);

  return (
    <>
      {/* Overlay do menu mobile */}
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}

      <aside
        id="navegacao-principal"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-line bg-surface',
          'transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Navegação principal"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
          <Link href="/dashboard" aria-label="Nexora — início">
            <NexoraLogo size="sm" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-overlay hover:text-ink lg:hidden"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-thin">
          {sections.map((section, index) => (
            <NavGroup
              key={section.title ?? `section-${index}`}
              section={section}
              pathname={pathname}
              badges={badges}
              onNavigate={onClose}
            />
          ))}
        </nav>

        <div className="shrink-0 border-t border-line p-3">
          <Link
            href="/configuracoes/perfil"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-overlay"
          >
            <Avatar name={user.name} src={user.avatarUrl} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
              <span className="block truncate text-xs text-ink-faint">{user.roleName}</span>
            </span>
          </Link>
        </div>
      </aside>
    </>
  );
}

function NavGroup({
  section,
  pathname,
  badges,
  onNavigate,
}: {
  section: NavSection;
  pathname: string;
  badges: { messages: number; notifications: number };
  onNavigate?: () => void;
}) {
  return (
    <div>
      {section.title ? (
        <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
          {section.title}
        </p>
      ) : null}

      <ul className="space-y-0.5">
        {section.items.map((item) => {
          // `/tarefas` ativo em `/tarefas/123`, mas `/admin` não fica ativo em `/admin/cargos`.
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && item.href !== '/admin' && pathname.startsWith(`${item.href}/`));

          const count = item.badge ? badges[item.badge] : 0;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-brand/12 font-medium text-brand-glow'
                    : 'text-ink-muted hover:bg-surface-overlay hover:text-ink',
                )}
              >
                <item.icon className={cn('size-4 shrink-0', isActive ? 'text-brand' : '')} aria-hidden />
                <span className="flex-1 truncate">{item.label}</span>
                {count > 0 ? (
                  <span className="min-w-5 rounded-full bg-danger px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
                    {count > 99 ? '99+' : count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
