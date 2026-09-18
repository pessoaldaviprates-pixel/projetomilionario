# Banco de dados

PostgreSQL 16, acessado via Prisma 7 com driver adapter (`@prisma/adapter-pg`).
**47 tabelas.** O schema completo e comentado está em `prisma/schema.prisma`.

## Princípios

1. **Multi-tenant por coluna** — toda entidade de negócio carrega `companyId`.
2. **Integridade explícita** — `onDelete` definido em cada relação; nada fica
   órfão nem é apagado por acidente.
3. **Índices começando por `companyId`** — o filtro de tenant é o predicado
   mais seletivo de toda query do sistema.
4. **Enums no banco** para estados finitos — o banco recusa valor inválido,
   não apenas a aplicação.
5. **Dinheiro em centavos** (`Int`) — ponto flutuante não representa 0,10
   exatamente.
6. **Exclusão lógica** onde o histórico importa (`deletedAt` em tarefas,
   mensagens e arquivos).

## Mapa das entidades

```
User ──┬── Membership ──── Company ──┬── Role
       │        │                    ├── Department ── Group ── GroupMember
       ├── Session                   │
       └── VerificationToken         ├── Channel ── ChannelMember
                                     │      └── Message ─┬─ MessageReaction
                                     │                   ├─ MessageRead
                                     │                   └─ FileObject
                                     │
                                     ├── Project ──┬── ProjectMember
                                     │             └── Task ─┬─ Task (subtarefa)
                                     │                       ├─ ChecklistItem
                                     │                       ├─ TaskComment
                                     │                       ├─ TaskWatcher
                                     │                       ├─ TaskActivity
                                     │                       ├─ TaskDependency
                                     │                       └─ TimeBlock
                                     │
                                     ├── Meeting ──┬── MeetingParticipant
                                     │             ├── MeetingNote
                                     │             ├── MeetingActionItem → Task
                                     │             └── MeetingRecording
                                     │
                                     ├── CalendarEvent ── EventAttendee
                                     ├── Folder ── FileObject
                                     ├── Notification
                                     ├── Announcement ── AnnouncementRead
                                     ├── Invitation
                                     ├── AuditLog
                                     ├── Integration
                                     ├── AiThread ── AiMessage
                                     ├── AiAction
                                     └── Subscription ── Payment
                                            └── Plan
```

## Decisões de modelagem

### `Membership` carrega o cargo, não `User`

Uma pessoa pode pertencer a várias empresas com cargos diferentes. Colocar
`roleId` em `User` tornaria isso impossível.

### Subtarefa é auto-relação em `Task`

Em vez de uma tabela `Subtask` separada. Uma subtarefa tem exatamente os
mesmos campos de uma tarefa — duplicar a estrutura criaria duas verdades.
A profundidade é limitada a um nível na aplicação, para manter UI e queries
previsíveis.

### `CalendarEvent` referencia a origem

Um evento pode vir de uma reunião (`meetingId`) ou do prazo de uma tarefa
(`taskId`). A agenda não é uma tabela paralela à realidade: ela **reflete** o
que existe nos outros módulos, e os serviços mantêm a sincronia
(`syncTaskEvent`).

### `Message.linkedTaskId`

Fecha o elo "conversa → tarefa". Permite abrir uma tarefa e ver a mensagem que
a originou, e vice-versa — a rastreabilidade é parte do valor do produto.

### `MeetingActionItem` é separado de `Task`

Um item de ação identificado pela IA **ainda não é** uma tarefa. Ele nasce com
status `SUGGESTED` e só vira `Task` quando uma pessoa aceita. Misturar os dois
significaria criar tarefa sem consentimento.

### `AiAction` com `status`

Mesmo princípio, aplicado às sugestões do chat: a IA propõe, o humano decide, e
a decisão fica registrada (`ACCEPTED` / `DISMISSED`) para auditoria.

### `Plan` no banco, não no código

Preços e limites são editáveis pelo administrador da plataforma sem deploy.
O que vive no código é apenas o **vocabulário** de recursos
(`src/lib/billing/entitlements.ts`).

### `Session` com `companyId`

Permite trocar de empresa sem novo login, mantendo o tenant ativo no servidor
— o cliente nunca precisa informá-lo.

## Índices principais

| Tabela | Índice | Consulta que atende |
| --- | --- | --- |
| `messages` | `(companyId, channelId, createdAt)` | histórico paginado do canal |
| `messages` | `(channelId, parentId, createdAt)` | respostas de uma thread |
| `tasks` | `(companyId, status, dueAt)` | tarefas abertas por prazo |
| `tasks` | `(companyId, assigneeId, status)` | "minhas tarefas" |
| `tasks` | `(companyId, projectId, status, position)` | kanban do projeto |
| `meetings` | `(companyId, startsAt)` | agenda e próximas reuniões |
| `calendar_events` | `(companyId, ownerId, startsAt)` | agenda pessoal |
| `notifications` | `(companyId, membershipId, readAt, createdAt)` | central de notificações |
| `audit_logs` | `(companyId, createdAt)` | trilha de auditoria |
| `files` | `(companyId, deletedAt, createdAt)` | arquivos ativos |

## Restrições de unicidade

| Restrição | Garante |
| --- | --- |
| `users.email` | uma conta por e-mail |
| `memberships (userId, companyId)` | um vínculo por pessoa e empresa |
| `roles (companyId, slug)` | cargo sem nome duplicado na empresa |
| `projects (companyId, key)` | prefixo de projeto único |
| `channels (companyId, slug)` | canal sem nome duplicado |
| `message_reactions (messageId, membershipId, emoji)` | uma reação por pessoa e emoji |
| `webhook_events (provider, eventId)` | idempotência de webhook |
| `sessions.tokenHash` | token de sessão único |

## Migrações

```bash
npm run db:migrate    # criar e aplicar (desenvolvimento)
npm run db:deploy     # aplicar (produção, sem gerar)
npm run db:reset      # recriar do zero (destrutivo)
npm run db:studio     # inspecionar visualmente
```

As migrações são versionadas em `prisma/migrations/` e devem ser aplicadas em
ordem. Nunca edite uma migração já aplicada em produção — crie outra.
