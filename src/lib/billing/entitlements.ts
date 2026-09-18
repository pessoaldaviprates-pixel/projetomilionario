/**
 * Entitlements (recursos liberados por plano).
 *
 * Preços e limites vivem no banco (tabela `plans`) para que o administrador da
 * plataforma possa alterá-los sem deploy. O que vive no código é apenas o
 * VOCABULÁRIO de recursos — o conjunto de chaves que o produto sabe checar.
 */

export const ENTITLEMENTS = {
  'chat.basic': 'Mensagens e canais',
  'chat.threads': 'Threads e respostas encadeadas',
  'tasks.basic': 'Tarefas e checklists',
  'projects.basic': 'Projetos e kanban',
  'projects.timeline': 'Timeline e dependências',
  'calendar.basic': 'Agenda',
  'calendar.timeblocking': 'Time blocking',
  'files.basic': 'Arquivos',
  'meetings.basic': 'Reuniões agendadas',
  'meetings.video': 'Reuniões por vídeo',
  'meetings.recording': 'Gravação de reuniões',
  'ai.assistant': 'Assistente de IA',
  'ai.meeting_summary': 'Resumo e ata automáticos de reunião',
  'ai.suggestions': 'Sugestões automáticas a partir do chat',
  'reports.basic': 'Relatórios e métricas',
  'reports.advanced': 'Relatórios avançados',
  'automations': 'Automações e workflows',
  'integrations': 'Integrações externas',
  'api.access': 'API e webhooks',
  'sso': 'SSO corporativo',
  'audit.advanced': 'Auditoria avançada',
  'support.priority': 'Suporte prioritário',
  'support.dedicated': 'Gerente de conta dedicado',
} as const;

export type Entitlement = keyof typeof ENTITLEMENTS;

export interface PlanSeed {
  slug: string;
  name: string;
  tagline: string;
  priceCents: number;
  maxUsers: number | null;
  storageGb: number;
  isPopular: boolean;
  position: number;
  features: string[];
  entitlements: Entitlement[];
}

const STARTER_ENTITLEMENTS: Entitlement[] = [
  'chat.basic', 'tasks.basic', 'projects.basic', 'calendar.basic', 'files.basic', 'meetings.basic',
];

const PRO_ENTITLEMENTS: Entitlement[] = [
  ...STARTER_ENTITLEMENTS,
  'chat.threads', 'projects.timeline', 'calendar.timeblocking',
  'meetings.video', 'meetings.recording',
  'ai.assistant', 'ai.meeting_summary', 'ai.suggestions',
  'reports.basic', 'automations', 'support.priority',
];

const ENTERPRISE_ENTITLEMENTS: Entitlement[] = [
  ...PRO_ENTITLEMENTS,
  'reports.advanced', 'integrations', 'api.access', 'sso', 'audit.advanced', 'support.dedicated',
];

/**
 * Catálogo inicial. É semeado no banco na primeira execução e a partir daí a
 * fonte de verdade é o banco — estes valores são só o ponto de partida.
 */
export const PLAN_SEEDS: PlanSeed[] = [
  {
    slug: 'inicial',
    name: 'Inicial',
    tagline: 'Para equipes em crescimento',
    priceCents: 4900,
    maxUsers: 10,
    storageGb: 10,
    isPopular: false,
    position: 1,
    features: [
      'Até 10 usuários',
      'Mensagens e grupos',
      'Agenda e tarefas',
      'Armazenamento de 10 GB',
      'Suporte por e-mail',
    ],
    entitlements: STARTER_ENTITLEMENTS,
  },
  {
    slug: 'profissional',
    name: 'Profissional',
    tagline: 'Para empresas em expansão',
    priceCents: 14900,
    maxUsers: 50,
    storageGb: 100,
    isPopular: true,
    position: 2,
    features: [
      'Até 50 usuários',
      'Tudo do plano Inicial',
      'Reuniões por vídeo',
      'Assistente de IA e resumos',
      'Armazenamento de 100 GB',
      'Relatórios e analytics',
      'Suporte prioritário',
    ],
    entitlements: PRO_ENTITLEMENTS,
  },
  {
    slug: 'corporativo',
    name: 'Corporativo',
    tagline: 'Para grandes empresas',
    priceCents: 29900,
    maxUsers: null,
    storageGb: 1000,
    isPopular: false,
    position: 3,
    features: [
      'Usuários ilimitados',
      'Tudo do plano Profissional',
      'Multiempresa (tenant)',
      'API e integrações',
      'SSO e auditoria avançada',
      'Suporte 24/7',
      'Gerente de conta exclusivo',
    ],
    entitlements: ENTERPRISE_ENTITLEMENTS,
  },
];

export function formatPrice(cents: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
