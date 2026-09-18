import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NexoraLogo } from '@/components/brand/logo';
import { getUserContext } from '@/lib/auth/context';

/**
 * Layout das telas de conta.
 * Duas colunas no desktop (marca à esquerda, formulário à direita); no mobile
 * a coluna de marca vira um cabeçalho compacto — não é a versão desktop reduzida.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Quem já está autenticado não vê tela de login.
  const ctx = await getUserContext();
  if (ctx) redirect(ctx.activeCompanyId ? '/dashboard' : '/onboarding');

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="grid-backdrop absolute inset-0 opacity-40" aria-hidden />
        <div
          className="absolute -top-32 -left-24 size-[480px] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, #2E7DFF 0%, transparent 70%)' }}
          aria-hidden
        />

        <div className="relative">
          <Link href="/" className="inline-block">
            <NexoraLogo size="md" />
          </Link>
        </div>

        <div className="relative max-w-md space-y-6">
          <p className="text-3xl leading-snug font-semibold text-balance text-ink">
            Conectando pessoas, ideias e resultados.
          </p>
          <p className="text-sm leading-relaxed text-ink-subtle">
            A Nexora reúne comunicação, tarefas, projetos, reuniões, agenda e arquivos em um só
            ambiente — com inteligência que transforma conversa em execução.
          </p>
          <ul className="space-y-3 pt-2">
            {[
              'Mensagens, canais e threads da equipe',
              'Tarefas que nascem do chat e da reunião',
              'Agenda, projetos e arquivos integrados',
              'Resumo e ata automáticos das reuniões',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-ink-muted">
                <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-ink-faint">
          © {new Date().getFullYear()} Nexora. Todos os direitos reservados.
        </p>
      </aside>

      <main id="conteudo" className="flex flex-col justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link href="/">
              <NexoraLogo size="md" />
            </Link>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
