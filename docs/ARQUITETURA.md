# Arquitetura

## Visão geral

A Nexora é uma aplicação Next.js única que serve interface e API no mesmo
processo. Não há microsserviços: para um produto neste estágio, a complexidade
operacional de vários serviços custaria mais do que entregaria. As fronteiras
existem no código (camadas bem separadas), não na rede — o que permite extrair
um módulo para fora quando houver motivo real.

```
┌──────────────────────────────────────────────────────────────┐
│ Navegador                                                    │
│  Server Components (HTML)  ·  Client Components (interação)  │
└───────────────┬──────────────────────────┬───────────────────┘
                │ Server Actions           │ fetch / SSE
┌───────────────▼──────────────────────────▼───────────────────┐
│ Next.js (App Router)                                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Guardas: requireAuth / requirePermission / route()     │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ Serviços de domínio (src/server/services)              │  │
│  │  autorização · regras de negócio · eventos · auditoria │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ Infraestrutura (src/lib)                               │  │
│  │  db · auth · storage · mail · ai · billing · realtime  │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────┬──────────────────────────────────────────────┘
                │ Prisma (driver adapter pg)
        ┌───────▼────────┐
        │  PostgreSQL    │
        └────────────────┘
```

## Camadas

### `src/lib` — infraestrutura

Módulos sem conhecimento do domínio. Todos expõem uma **interface** e uma
implementação padrão, o que permite trocar a implementação sem tocar em quem
chama:

| Módulo | Interface | Padrão hoje | Alternativa preparada |
| --- | --- | --- | --- |
| `storage` | `StorageDriver` | disco local | S3 / R2 |
| `mail` | `MailDriver` | console (log) | SMTP / provedor HTTP |
| `ai` | `AiProvider` | heurístico local | API da Anthropic |
| `billing/gateway` | `PaymentGateway` | manual | Stripe / adquirente |
| `realtime/bus` | `EventBus` | EventEmitter | Redis Pub/Sub |
| `http/rate-limit` | `RateLimiter` | memória | Redis |

### `src/server/services` — domínio

Onde vive a regra de negócio. Toda função de serviço recebe um `AuthContext`
como primeiro argumento e é responsável por:

1. verificar a permissão (`assertPermission`);
2. escopar a consulta ao tenant (`scoped` / `scopedId`);
3. executar a operação;
4. registrar auditoria e publicar evento de tempo real.

### `src/app` — interface e rotas

Server Components fazem a busca de dados; Client Components cuidam apenas de
interação. A divisão é deliberada: menos JavaScript enviado ao navegador e
nenhum segredo cruzando a fronteira.

## Multi-tenancy

O isolamento é por **coluna** (`companyId` em toda tabela de negócio), não por
schema nem por banco. A razão é operacional: um schema por empresa tornaria
migração, backup e conexão proporcionalmente mais caros a cada cliente novo.

O que torna a coluna segura é onde o `companyId` nasce:

```ts
// O cliente NUNCA informa em qual empresa está operando.
const ctx = await requireAuth();        // resolve da sessão, no servidor
const tasks = await prisma.task.findMany({ where: scoped(ctx) });
```

Três mecanismos reforçam isso:

- `scoped(ctx)` e `scopedId(ctx, id)` são a única forma de montar um `where`
  de entidade de negócio;
- `assertTenant()` é a rede de segurança para registros já carregados;
- recurso de outro tenant responde **404**, nunca 403 — confirmar que algo
  existe já é vazamento.

Há teste de integração cobrindo cada caminho
(`tests/integration/tenant-isolation.test.ts`).

## Autorização

Dois níveis:

1. **Permissões granulares** (48 chaves em `src/lib/authz/permissions.ts`),
   atribuídas a cargos totalmente editáveis pelo administrador.
2. **Propriedade do recurso** — quem criou ou é responsável edita o próprio
   item sem precisar de permissão administrativa
   (`assertPermissionOrOwner`).

A interface esconde o que a pessoa não pode fazer, mas isso é **UX**. A decisão
que vale é sempre a do servidor, dentro do serviço.

## Fluxo de uma requisição

Exemplo: criar tarefa a partir do kanban.

```
1. Cliente     POST /api/tarefas  { title, dueAt, assigneeId }
2. route()     valida corpo com zod → rejeita 422 se inválido
3. getAuthContext()  resolve sessão → usuário → empresa ativa → permissões
4. rate limit  120 mutações/min por membership
5. service     assertPermission('tasks.create')
               assertPermission('tasks.assign') se for para outra pessoa
               valida que projeto e responsável são do MESMO tenant
6. transação   cria tarefa + checklist + atividade + observadores
7. efeitos     evento de agenda, progresso do projeto, notificação, auditoria
8. resposta    201 { data: task }
```

Se qualquer passo lançar, `handleError` traduz para o status correto e devolve
mensagem em português sem expor detalhe interno.

## Tempo real

SSE (`/api/eventos`), escolhido em vez de WebSocket porque o tráfego do produto
é quase todo servidor → cliente, e SSE atravessa qualquer proxy HTTP,
reconectando sozinho.

A assinatura é feita pelo `companyId` **da sessão** — o cliente não escolhe o
que escuta, o que torna impossível assinar o fluxo de outra empresa.

Para escalar horizontalmente, basta trocar `InMemoryBus` por um adaptador Redis
que implemente `EventBus`; nenhum serviço muda.

## Inteligência artificial

Dois provedores atrás da mesma interface:

- **`heuristic`** (padrão): determinístico, roda offline, sem custo e sem enviar
  dado algum para fora. É o que garante que os fluxos de IA funcionem em
  qualquer ambiente.
- **`anthropic`**: usa a API da Anthropic para texto de qualidade superior
  (resumo, ata, respostas).

Mesmo com LLM ativo, **prazo e responsável continuam vindo do extrator
determinístico** — modelo de linguagem erra data com frequência, e aqui a
precisão importa mais que a fluência.

Duas garantias estruturais:

1. A IA só enxerga o que o usuário enxerga: o contexto é montado com o
   `AuthContext` da pessoa e filtrado por permissão.
2. A IA nunca escreve sozinha: gera `AiAction` com status `SUGGESTED`, e a
   escrita só ocorre quando alguém aceita.

## Performance

- **Paginação por cursor** em chat e listas longas — `OFFSET` degrada
  linearmente e "pula" registros com inserções concorrentes.
- **Agregações no banco** (`groupBy`, `count`) em vez de trazer linhas para
  contar no Node.
- **Índices compostos começando por `companyId`**: o filtro de tenant é o
  predicado mais seletivo de toda query do sistema.
- **`Promise.all`** nas páginas: os dados são buscados em paralelo, não em
  cascata.
- **Atualização otimista** no kanban, reações e checklist: a interface responde
  na hora e reverte se o servidor recusar.

## Estrutura de pastas

```
prisma/          schema, migrações e seed
src/
  app/
    (marketing)/   landing, planos, checkout
    (auth)/        login, cadastro, recuperação, convite
    (onboarding)/  criação de empresa e equipe
    (app)/         produto autenticado
    api/           rotas HTTP
  components/
    ui/            primitivos do design system
    layout/        casca, navegação, command palette
    app/           componentes de domínio compartilhados
  lib/             infraestrutura (ver tabela acima)
  server/
    services/      regras de negócio
    actions/       Server Actions de formulário
tests/
  unit/            lógica pura
  integration/     contra o banco real
docs/              esta documentação
```
