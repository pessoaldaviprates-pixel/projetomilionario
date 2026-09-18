import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/misc';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Nexora — Pessoas + Processos + Resultados',
    template: '%s · Nexora',
  },
  description:
    'A Nexora reúne comunicação, tarefas, projetos, reuniões, agenda, arquivos e inteligência artificial em um único ambiente corporativo.',
  applicationName: 'Nexora',
  authors: [{ name: 'Nexora' }],
  keywords: ['SaaS', 'produtividade', 'gestão', 'comunicação corporativa', 'reuniões', 'tarefas'],
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#05070D',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-dvh bg-base antialiased">
        {/* Atalho de acessibilidade: primeiro Tab da página pula a navegação. */}
        <a
          href="#conteudo"
          className="sr-only-focusable fixed top-4 left-4 z-[100] rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          Pular para o conteúdo
        </a>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#121B2E',
              border: '1px solid #1B2436',
              color: '#F2F6FD',
            },
          }}
        />
      </body>
    </html>
  );
}
