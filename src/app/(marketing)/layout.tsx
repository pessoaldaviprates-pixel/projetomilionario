import Link from 'next/link';
import { NexoraLogo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { getUserContext } from '@/lib/auth/context';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getUserContext();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-base/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <Link href="/" aria-label="Nexora — página inicial">
            <NexoraLogo size="sm" />
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {[
              { href: '/planos', label: 'Planos' },
              { href: '/#recursos', label: 'Recursos' },
              { href: '/#inteligencia', label: 'Inteligência' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-overlay hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {ctx ? (
              <Button asChild size="sm">
                <Link href={ctx.activeCompanyId ? '/dashboard' : '/onboarding'}>Abrir Nexora</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">Entrar</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/cadastro">Começar agora</Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      </header>

      <main id="conteudo">{children}</main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xs space-y-3">
              <NexoraLogo size="sm" showTagline />
              <p className="text-sm text-ink-subtle">
                A plataforma que conecta comunicação, execução e resultado no mesmo lugar.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              {[
                { title: 'Produto', links: [['Planos', '/planos'], ['Recursos', '/#recursos'], ['Inteligência', '/#inteligencia']] },
                { title: 'Conta', links: [['Entrar', '/login'], ['Criar conta', '/cadastro']] },
                { title: 'Legal', links: [['Termos de uso', '/planos'], ['Privacidade', '/planos']] },
              ].map((group) => (
                <div key={group.title}>
                  <p className="mb-3 text-xs font-semibold tracking-wide text-ink-faint uppercase">{group.title}</p>
                  <ul className="space-y-2">
                    {group.links.map(([label, href]) => (
                      <li key={label}>
                        <Link
                          href={href!}
                          className="inline-flex min-h-6 items-center py-1 text-sm text-ink-muted transition-colors hover:text-ink"
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-10 border-t border-line pt-6 text-xs text-ink-faint">
            © {new Date().getFullYear()} Nexora. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
