'use client';

import Link from 'next/link';
import { Bell, HelpCircle, LogOut, Menu, Settings, Sparkles, User } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { CommandPalette } from './command-palette';
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import { logoutAction } from '@/server/actions/auth.actions';

export interface TopbarProps {
  user: { name: string; email: string; avatarUrl: string | null };
  company: { name: string };
  roleName: string;
  unreadNotifications: number;
  onOpenMenu: () => void;
}

export function Topbar({ user, company, roleName, unreadNotifications, onOpenMenu }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-base/85 px-4 backdrop-blur-xl sm:px-5">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Abrir menu de navegação"
        aria-controls="navegacao-principal"
        className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-overlay hover:text-ink lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <div className="flex-1 md:max-w-md">
        <CommandPalette />
      </div>

      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex" title="Assistente de IA">
          <Link href="/ia" aria-label="Assistente de IA">
            <Sparkles className="size-[18px]" aria-hidden />
          </Link>
        </Button>

        <Button asChild variant="ghost" size="icon" className="relative" title="Notificações">
          <Link href="/notificacoes" aria-label={`Notificações${unreadNotifications > 0 ? `: ${unreadNotifications} não lidas` : ''}`}>
            <Bell className="size-[18px]" aria-hidden />
            {unreadNotifications > 0 ? (
              <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            ) : null}
          </Link>
        </Button>

        <Dropdown>
          <DropdownTrigger asChild>
            <button
              type="button"
              className="ml-1 flex items-center gap-2.5 rounded-xl py-1 pr-2 pl-1 transition-colors hover:bg-surface-overlay"
              aria-label="Menu da conta"
            >
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
              <span className="hidden text-left sm:block">
                <span className="block max-w-32 truncate text-xs font-medium text-ink">{user.name}</span>
                <span className="block text-[11px] text-ink-faint">{roleName}</span>
              </span>
            </button>
          </DropdownTrigger>

          <DropdownContent className="w-60">
            <DropdownLabel>{company.name}</DropdownLabel>
            <div className="px-2.5 pb-2">
              <p className="truncate text-sm text-ink">{user.name}</p>
              <p className="truncate text-xs text-ink-faint">{user.email}</p>
            </div>
            <DropdownSeparator />
            <DropdownItem asChild>
              <Link href="/configuracoes/perfil">
                <User className="size-4" aria-hidden /> Meu perfil
              </Link>
            </DropdownItem>
            <DropdownItem asChild>
              <Link href="/configuracoes">
                <Settings className="size-4" aria-hidden /> Configurações
              </Link>
            </DropdownItem>
            <DropdownItem asChild>
              <Link href="/ia">
                <HelpCircle className="size-4" aria-hidden /> Perguntar à Nexora
              </Link>
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem asChild danger>
              <form action={logoutAction}>
                <button type="submit" className="flex w-full items-center gap-2.5">
                  <LogOut className="size-4" aria-hidden /> Sair
                </button>
              </form>
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </header>
  );
}
