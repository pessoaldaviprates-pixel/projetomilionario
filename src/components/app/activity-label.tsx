/** Traduz uma ação de auditoria para uma frase legível no feed de atividade. */
const ACTION_LABELS: Record<string, string> = {
  'company.created': 'criou a empresa',
  'company.updated': 'atualizou os dados da empresa',
  'company.onboarded': 'concluiu a configuração inicial',
  'member.invited': 'convidou uma pessoa',
  'member.joined': 'entrou na empresa',
  'member.updated': 'atualizou um funcionário',
  'member.deactivated': 'desativou um funcionário',
  'member.role_changed': 'alterou o cargo de um funcionário',
  'role.created': 'criou um cargo',
  'role.updated': 'atualizou um cargo',
  'role.deleted': 'excluiu um cargo',
  'role.permissions_changed': 'alterou permissões de um cargo',
  'department.created': 'criou um departamento',
  'department.updated': 'atualizou um departamento',
  'department.deleted': 'excluiu um departamento',
  'project.created': 'criou um projeto',
  'project.updated': 'atualizou um projeto',
  'project.deleted': 'arquivou um projeto',
  'task.created': 'criou uma tarefa',
  'task.updated': 'atualizou uma tarefa',
  'task.completed': 'concluiu uma tarefa',
  'task.deleted': 'excluiu uma tarefa',
  'meeting.created': 'agendou uma reunião',
  'meeting.updated': 'atualizou uma reunião',
  'meeting.canceled': 'cancelou uma reunião',
  'file.uploaded': 'enviou um arquivo',
  'file.deleted': 'excluiu um arquivo',
  'announcement.published': 'publicou um aviso',
  'billing.subscription_created': 'contratou um plano',
  'billing.plan_changed': 'alterou o plano',
  'billing.canceled': 'cancelou a assinatura',
  'ai.action_accepted': 'aceitou uma sugestão da IA',
  'ai.action_dismissed': 'descartou uma sugestão da IA',
  'integration.connected': 'conectou uma integração',
};

export function ActivityLabel({ action, metadata }: { action: string; metadata?: unknown }) {
  const label = ACTION_LABELS[action] ?? action.replace(/\./g, ' ');
  const detail =
    metadata && typeof metadata === 'object' && metadata !== null
      ? ((metadata as Record<string, unknown>).name ?? (metadata as Record<string, unknown>).title)
      : null;

  return (
    <>
      {label}
      {typeof detail === 'string' ? <span className="text-ink"> “{detail}”</span> : null}
    </>
  );
}
