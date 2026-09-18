/**
 * Catálogo de permissões do Nexora.
 *
 * Este arquivo é a ÚNICA fonte de verdade sobre o que existe no sistema em
 * termos de autorização. Ele é isomórfico (usado no servidor para decidir e no
 * cliente para esconder/desabilitar UI) — mas a decisão que vale é sempre a do
 * servidor. O cliente apenas evita mostrar botões que iriam falhar.
 */

export const PERMISSIONS = {
  // Empresa
  'company.view': 'Ver dados da empresa',
  'company.manage': 'Editar dados e configurações da empresa',
  'company.delete': 'Excluir a empresa',

  // Pessoas
  'users.view': 'Ver funcionários',
  'users.invite': 'Convidar funcionários',
  'users.create': 'Criar funcionários',
  'users.update': 'Editar funcionários',
  'users.deactivate': 'Desativar funcionários',
  'users.delete': 'Excluir funcionários',

  // Cargos e permissões
  'roles.view': 'Ver cargos',
  'roles.manage': 'Criar, editar e excluir cargos',
  'roles.assign': 'Atribuir cargos a funcionários',
  'permissions.manage': 'Definir permissões dos cargos',

  // Estrutura organizacional
  'departments.view': 'Ver departamentos',
  'departments.manage': 'Gerenciar departamentos',
  'groups.view': 'Ver grupos e equipes',
  'groups.manage': 'Gerenciar grupos e equipes',

  // Comunicação
  'channels.view': 'Ver canais',
  'channels.create': 'Criar canais',
  'channels.manage': 'Gerenciar canais',
  'messages.send': 'Enviar mensagens',
  'messages.moderate': 'Moderar e excluir mensagens de terceiros',

  // Projetos
  'projects.view': 'Ver projetos',
  'projects.create': 'Criar projetos',
  'projects.update': 'Editar projetos',
  'projects.delete': 'Excluir projetos',

  // Tarefas
  'tasks.view': 'Ver tarefas',
  'tasks.create': 'Criar tarefas',
  'tasks.update': 'Editar tarefas',
  'tasks.assign': 'Atribuir tarefas a outras pessoas',
  'tasks.delete': 'Excluir tarefas',

  // Reuniões
  'meetings.view': 'Ver reuniões',
  'meetings.create': 'Agendar reuniões',
  'meetings.manage': 'Gerenciar reuniões de terceiros',

  // Agenda
  'calendar.view': 'Ver agenda',
  'calendar.manage': 'Gerenciar eventos da agenda',

  // Arquivos
  'files.view': 'Ver arquivos',
  'files.upload': 'Enviar arquivos',
  'files.delete': 'Excluir arquivos',
  'files.manage': 'Gerenciar permissões de arquivos',

  // Avisos
  'announcements.view': 'Ver avisos',
  'announcements.publish': 'Publicar avisos da empresa',

  // Financeiro e assinatura
  'billing.view': 'Ver informações financeiras e faturas',
  'billing.manage': 'Gerenciar plano, pagamentos e assinatura',

  // Relatórios
  'reports.view': 'Acessar relatórios e métricas',

  // IA
  'ai.use': 'Usar o assistente de IA',
  'ai.manage': 'Configurar o comportamento da IA na empresa',

  // Plataforma
  'settings.manage': 'Gerenciar configurações do sistema',
  'integrations.manage': 'Gerenciar integrações',
  'audit.view': 'Ver logs de auditoria',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Agrupamento usado na tela de edição de cargos. */
export const PERMISSION_GROUPS: { key: string; label: string; permissions: Permission[] }[] = [
  {
    key: 'general',
    label: 'Geral',
    permissions: ['company.view', 'company.manage', 'company.delete', 'settings.manage', 'reports.view'],
  },
  {
    key: 'people',
    label: 'Pessoas',
    permissions: [
      'users.view', 'users.invite', 'users.create', 'users.update', 'users.deactivate', 'users.delete',
      'roles.view', 'roles.manage', 'roles.assign', 'permissions.manage',
      'departments.view', 'departments.manage', 'groups.view', 'groups.manage',
    ],
  },
  {
    key: 'work',
    label: 'Projetos e tarefas',
    permissions: [
      'projects.view', 'projects.create', 'projects.update', 'projects.delete',
      'tasks.view', 'tasks.create', 'tasks.update', 'tasks.assign', 'tasks.delete',
      'meetings.view', 'meetings.create', 'meetings.manage',
      'calendar.view', 'calendar.manage',
    ],
  },
  {
    key: 'communication',
    label: 'Comunicação e arquivos',
    permissions: [
      'channels.view', 'channels.create', 'channels.manage',
      'messages.send', 'messages.moderate',
      'files.view', 'files.upload', 'files.delete', 'files.manage',
      'announcements.view', 'announcements.publish',
    ],
  },
  {
    key: 'financial',
    label: 'Financeiro',
    permissions: ['billing.view', 'billing.manage'],
  },
  {
    key: 'system',
    label: 'Sistema',
    permissions: ['ai.use', 'ai.manage', 'integrations.manage', 'audit.view'],
  },
];

/** Permissões mínimas que todo funcionário ativo recebe. */
export const BASE_EMPLOYEE_PERMISSIONS: Permission[] = [
  'company.view',
  'users.view',
  'roles.view',
  'departments.view',
  'groups.view',
  'channels.view',
  'messages.send',
  'projects.view',
  'tasks.view',
  'tasks.create',
  'tasks.update',
  'meetings.view',
  'meetings.create',
  'calendar.view',
  'calendar.manage',
  'files.view',
  'files.upload',
  'announcements.view',
  'ai.use',
];

const MANAGER_PERMISSIONS: Permission[] = [
  ...BASE_EMPLOYEE_PERMISSIONS,
  'users.invite',
  'channels.create',
  'projects.create',
  'projects.update',
  'tasks.assign',
  'tasks.delete',
  'meetings.manage',
  'files.delete',
  'announcements.publish',
  'reports.view',
];

const DIRECTOR_PERMISSIONS: Permission[] = [
  ...MANAGER_PERMISSIONS,
  'users.create',
  'users.update',
  'users.deactivate',
  'roles.assign',
  'departments.manage',
  'groups.manage',
  'channels.manage',
  'messages.moderate',
  'projects.delete',
  'files.manage',
  'audit.view',
];

/**
 * Cargos semeados na criação de uma empresa.
 * O administrador pode editar, desativar ou criar novos livremente — nada aqui
 * é imutável, é apenas um ponto de partida sensato.
 */
export interface RolePreset {
  slug: string;
  name: string;
  description: string;
  color: string;
  rank: number;
  permissions: Permission[];
  isDefault?: boolean;
}

export const DEFAULT_ROLE_PRESETS: RolePreset[] = [
  {
    slug: 'ceo',
    name: 'CEO',
    description: 'Direção geral da empresa',
    color: '#2E7DFF',
    rank: 10,
    permissions: ALL_PERMISSIONS,
  },
  {
    slug: 'cto',
    name: 'CTO',
    description: 'Tecnologia e desenvolvimento',
    color: '#8B5CF6',
    rank: 20,
    permissions: [...DIRECTOR_PERMISSIONS, 'integrations.manage', 'ai.manage', 'settings.manage'],
  },
  {
    slug: 'cfo',
    name: 'CFO',
    description: 'Financeiro e estratégia',
    color: '#10B981',
    rank: 20,
    permissions: [...DIRECTOR_PERMISSIONS, 'billing.view', 'billing.manage'],
  },
  {
    slug: 'coo',
    name: 'COO',
    description: 'Operações e processos',
    color: '#F59E0B',
    rank: 20,
    permissions: DIRECTOR_PERMISSIONS,
  },
  {
    slug: 'cmo',
    name: 'CMO',
    description: 'Marketing e crescimento',
    color: '#EC4899',
    rank: 20,
    permissions: DIRECTOR_PERMISSIONS,
  },
  {
    slug: 'rh',
    name: 'RH',
    description: 'Recursos humanos',
    color: '#06B6D4',
    rank: 30,
    permissions: [
      ...MANAGER_PERMISSIONS,
      'users.create', 'users.update', 'users.deactivate', 'roles.assign',
      'departments.manage', 'groups.manage',
    ],
  },
  {
    slug: 'gerente',
    name: 'Gerente',
    description: 'Gestão de equipe e entregas',
    color: '#3B82F6',
    rank: 40,
    permissions: MANAGER_PERMISSIONS,
  },
  {
    slug: 'coordenador',
    name: 'Coordenador',
    description: 'Coordenação de time',
    color: '#60A5FA',
    rank: 50,
    permissions: [...BASE_EMPLOYEE_PERMISSIONS, 'tasks.assign', 'projects.create', 'channels.create'],
  },
  {
    slug: 'desenvolvedor',
    name: 'Desenvolvedor',
    description: 'Desenvolvimento de software',
    color: '#22C55E',
    rank: 60,
    permissions: BASE_EMPLOYEE_PERMISSIONS,
  },
  {
    slug: 'designer',
    name: 'Designer',
    description: 'Design e experiência do usuário',
    color: '#A855F7',
    rank: 60,
    permissions: BASE_EMPLOYEE_PERMISSIONS,
  },
  {
    slug: 'marketing',
    name: 'Marketing',
    description: 'Marketing e comunicação',
    color: '#F472B6',
    rank: 60,
    permissions: BASE_EMPLOYEE_PERMISSIONS,
  },
  {
    slug: 'financeiro',
    name: 'Financeiro',
    description: 'Rotinas financeiras',
    color: '#14B8A6',
    rank: 60,
    permissions: [...BASE_EMPLOYEE_PERMISSIONS, 'billing.view'],
  },
  {
    slug: 'suporte',
    name: 'Suporte',
    description: 'Atendimento ao cliente',
    color: '#FB923C',
    rank: 60,
    permissions: BASE_EMPLOYEE_PERMISSIONS,
  },
  {
    slug: 'funcionario',
    name: 'Funcionário',
    description: 'Acesso padrão à plataforma',
    color: '#94A3B8',
    rank: 90,
    permissions: BASE_EMPLOYEE_PERMISSIONS,
    isDefault: true,
  },
];

export function isValidPermission(value: string): value is Permission {
  return value in PERMISSIONS;
}

/** Remove chaves desconhecidas — protege contra injeção de permissões inventadas. */
export function sanitizePermissions(values: string[]): Permission[] {
  return Array.from(new Set(values.filter(isValidPermission)));
}
