'use client';

import { useState } from 'react';
import { Sidebar, type SidebarUser } from './sidebar';
import { Topbar } from './topbar';

export interface AppShellProps {
  children: React.ReactNode;
  permissions: string[];
  isOwner: boolean;
  user: { name: string; email: string; avatarUrl: string | null };
  company: { name: string };
  roleName: string;
  badges: { messages: number; notifications: number };
}

/**
 * Casca da aplicação.
 *
 * O estado do menu é a única coisa que precisa de cliente aqui — todo o resto
 * (permissões, contadores, dados) é resolvido no servidor e chega como prop.
 */
export function AppShell({ children, permissions, isOwner, user, company, roleName, badges }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const sidebarUser: SidebarUser = {
    name: user.name,
    avatarUrl: user.avatarUrl,
    roleName,
    companyName: company.name,
  };

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        permissions={permissions}
        isOwner={isOwner}
        user={sidebarUser}
        badges={badges}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          user={user}
          company={company}
          roleName={roleName}
          unreadNotifications={badges.notifications}
          onOpenMenu={() => setMenuOpen(true)}
        />
        <main id="conteudo" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
