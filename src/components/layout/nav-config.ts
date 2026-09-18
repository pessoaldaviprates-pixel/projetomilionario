import type { LucideIcon } from 'lucide-react';
import {
  Bell, Building2, Calendar, FileText, FolderKanban, Home, ListTodo,
  Megaphone, MessageSquare, Network, Settings, Shield, ShieldCheck,
  Sparkles, Target, Users, UsersRound, Video, Wallet,
} from 'lucide-react';
import type { Permission } from '@/lib/authz/permissions';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Item só aparece se o usuário tiver esta permissão. */
  permission?: Permission;
  /** Chave do contador de badge resolvido no servidor. */
  badge?: 'messages' | 'notifications';
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/** Navegação principal — a mesma estrutura no desktop e no menu mobile. */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/dashboard', label: 'Início', icon: Home },
      { href: '/hoje', label: 'Hoje', icon: Target },
      { href: '/mensagens', label: 'Mensagens', icon: MessageSquare, permission: 'channels.view', badge: 'messages' },
      { href: '/tarefas', label: 'Tarefas', icon: ListTodo, permission: 'tasks.view' },
      { href: '/projetos', label: 'Projetos', icon: FolderKanban, permission: 'projects.view' },
      { href: '/reunioes', label: 'Reuniões', icon: Video, permission: 'meetings.view' },
      { href: '/agenda', label: 'Agenda', icon: Calendar, permission: 'calendar.view' },
      { href: '/arquivos', label: 'Arquivos', icon: FileText, permission: 'files.view' },
      { href: '/ia', label: 'Assistente', icon: Sparkles, permission: 'ai.use' },
    ],
  },
  {
    title: 'Empresa',
    items: [
      { href: '/funcionarios', label: 'Funcionários', icon: Users, permission: 'users.view' },
      { href: '/grupos', label: 'Grupos', icon: UsersRound, permission: 'groups.view' },
      { href: '/departamentos', label: 'Departamentos', icon: Network, permission: 'departments.view' },
      { href: '/organograma', label: 'Organograma', icon: Building2, permission: 'users.view' },
      { href: '/avisos', label: 'Avisos', icon: Megaphone, permission: 'announcements.view' },
      { href: '/notificacoes', label: 'Notificações', icon: Bell, badge: 'notifications' },
    ],
  },
  {
    title: 'Administração',
    items: [
      { href: '/admin', label: 'Painel', icon: ShieldCheck, permission: 'reports.view' },
      { href: '/admin/cargos', label: 'Cargos', icon: Shield, permission: 'roles.view' },
      { href: '/admin/assinatura', label: 'Assinatura', icon: Wallet, permission: 'billing.view' },
      { href: '/admin/seguranca', label: 'Segurança e logs', icon: Shield, permission: 'audit.view' },
      { href: '/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
];

/** Filtra a navegação pelo conjunto de permissões efetivas do usuário. */
export function visibleSections(permissions: Set<string>, isOwner: boolean): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.permission || isOwner || permissions.has(item.permission)),
  })).filter((section) => section.items.length > 0);
}
