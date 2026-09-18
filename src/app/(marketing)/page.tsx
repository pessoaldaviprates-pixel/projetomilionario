import Link from 'next/link';
import {
  ArrowRight, Calendar, CheckCircle2, FileText, FolderKanban,
  ListTodo, MessageSquare, Shield, Sparkles, Users, Video, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { NexoraMark } from '@/components/brand/logo';

const MODULES = [
  { icon: MessageSquare, title: 'Comunicação', description: 'Canais, conversas diretas, threads, menções e arquivos — tudo pesquisável.' },
  { icon: ListTodo, title: 'Tarefas', description: 'Status, prioridade, prazo, checklist, subtarefas e dependências.' },
  { icon: FolderKanban, title: 'Projetos', description: 'Lista, kanban, calendário e progresso calculado a partir das entregas reais.' },
  { icon: Video, title: 'Reuniões', description: 'Agendamento, pauta, participantes, transcrição, resumo e ata.' },
  { icon: Calendar, title: 'Agenda', description: 'Dia, semana e mês com time blocking: arraste a tarefa para o horário.' },
  { icon: FileText, title: 'Arquivos', description: 'Central organizada por projeto, tarefa e conversa, com permissões.' },
  { icon: Users, title: 'Pessoas', description: 'Cargos personalizados, permissões granulares, departamentos e organograma.' },
  { icon: Shield, title: 'Segurança', description: 'Isolamento por empresa, auditoria completa e controle de sessões.' },
];

const FLOW = [
  { step: 'Conversa', text: '"Precisamos terminar a apresentação para sexta-feira."' },
  { step: 'Sugestão', text: 'A Nexora identifica a intenção, o prazo e o responsável.' },
  { step: 'Tarefa', text: 'Você confirma. A tarefa nasce com prazo e dono definidos.' },
  { step: 'Execução', text: 'Entra na agenda, notifica quem precisa e aparece no projeto.' },
];

export default function LandingPage() {
  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="grid-backdrop absolute inset-0 opacity-30" aria-hidden />
        <div
          className="absolute top-[-20%] left-1/2 size-[700px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #2E7DFF 0%, transparent 65%)' }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-5xl px-5 py-20 text-center sm:py-28">
          <Badge tone="brand" className="mb-6">
            <Sparkles className="size-3" aria-hidden />
            Comunicação que vira execução
          </Badge>

          <h1 className="text-4xl leading-[1.1] font-bold tracking-tight text-balance sm:text-6xl">
            Sua empresa,{' '}
            <span className="bg-gradient-to-r from-brand-glow via-brand to-brand-strong bg-clip-text text-transparent">
              mais organizada
            </span>
            ,<br className="hidden sm:block" /> conectada e produtiva.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-balance text-ink-muted">
            A Nexora reúne mensagens, tarefas, projetos, reuniões, agenda e arquivos em um único
            ambiente — com inteligência que transforma o que foi dito em algo que foi feito.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/cadastro">
                Começar agora <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
              <Link href="/planos">Ver planos</Link>
            </Button>
          </div>

          <p className="mt-5 text-xs text-ink-faint">
            Sem cartão de crédito para começar · Dados isolados por empresa
          </p>
        </div>
      </section>

      {/* ── Fluxo (o diferencial) ───────────────────────────────────────── */}
      <section id="inteligencia" className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <Badge tone="accent" className="mb-4">Diferencial</Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              A conversa não morre no chat.
            </h2>
            <p className="mt-4 text-ink-muted">
              Em outras ferramentas, a decisão fica perdida numa thread. Na Nexora, ela vira tarefa,
              prazo, responsável e acompanhamento — sem ninguém precisar redigitar nada.
            </p>
          </div>

          <ol className="mt-12 grid gap-4 md:grid-cols-4">
            {FLOW.map((item, index) => (
              <li key={item.step} className="relative">
                <Card className="h-full p-5">
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-brand/12 text-xs font-bold text-brand">
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold text-ink">{item.step}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-ink-subtle">{item.text}</p>
                </Card>
                {index < FLOW.length - 1 ? (
                  <ArrowRight
                    className="absolute top-1/2 -right-3 hidden size-4 -translate-y-1/2 text-ink-faint md:block"
                    aria-hidden
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Módulos ─────────────────────────────────────────────────────── */}
      <section id="recursos" className="border-b border-line">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Um sistema, não oito ferramentas soltas.
            </h2>
            <p className="mt-4 text-ink-muted">
              Cada módulo conhece os outros. O arquivo do projeto aparece no projeto. A reunião do
              projeto aparece no projeto. A tarefa da reunião aparece nas tarefas.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((module) => (
              <Card key={module.title} className="group p-5 transition-colors hover:border-brand/40">
                <module.icon className="mb-4 size-5 text-brand" aria-hidden />
                <h3 className="text-sm font-semibold text-ink">{module.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-subtle">{module.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Produtividade ───────────────────────────────────────────────── */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <Badge tone="brand" className="mb-4">
              <Zap className="size-3" aria-hidden />
              Centro de produtividade
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Abra a Nexora pela manhã e saiba exatamente o que fazer.
            </h2>
            <p className="mt-4 leading-relaxed text-ink-muted">
              Um lugar que reúne as tarefas do dia, as reuniões, os prazos próximos e as prioridades —
              e que deixa você reservar blocos de foco arrastando a tarefa para o horário.
            </p>

            <ul className="mt-6 space-y-3">
              {[
                'Tarefas atrasadas e do dia, separadas',
                'Reuniões com participantes e link da sala',
                'Blocos de foco sincronizados com as tarefas',
                'Notificações do que realmente precisa de você',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-ink-muted">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>

            <Button asChild className="mt-8">
              <Link href="/cadastro">
                Experimentar <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-line px-5 py-3.5">
              <p className="text-sm font-semibold text-ink">Hoje</p>
              <p className="text-xs text-ink-faint">Suas prioridades do dia</p>
            </div>
            <div className="divide-y divide-line">
              {[
                { title: 'Corrigir lentidão do cliente Atlas', meta: 'Urgente · hoje 18:00', tone: 'text-danger' },
                { title: 'Revisar pull requests pendentes', meta: 'Em andamento · hoje 17:00', tone: 'text-warning' },
                { title: 'Reunião de equipe', meta: '08:00 — 10:00 · 5 participantes', tone: 'text-brand' },
                { title: 'Finalizar layout do dashboard', meta: 'Alta · amanhã', tone: 'text-ink-subtle' },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 px-5 py-3.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{item.title}</p>
                    <p className={`mt-0.5 text-xs ${item.tone}`}>{item.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* ── CTA final ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(ellipse at center, #2E7DFF 0%, transparent 60%)' }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl px-5 py-24 text-center">
          <NexoraMark className="mx-auto mb-6 size-12" />
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Juntos vamos mais longe.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-muted">
            A Nexora foi criada para conectar pessoas, facilitar o trabalho e impulsionar
            grandes resultados.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/cadastro">
              Criar minha empresa <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
