# Estado e roadmap

Este documento é deliberadamente honesto sobre o que funciona, o que é
arquitetura preparada e o que ainda não existe.

Legenda: **✅ funcional** · **🟡 preparado** (estrutura pronta, falta
integração externa) · **⬜ não iniciado**

---

## Fase 1 — Fundação ✅

| Item | Estado | Observação |
| --- | --- | --- |
| Modelo de dados | ✅ | 47 tabelas, migrações versionadas |
| Multi-tenancy | ✅ | Isolamento por coluna, coberto por teste de integração |
| Cadastro e login | ✅ | bcrypt custo 12, bloqueio progressivo |
| Sessões | ✅ | Opacas em banco, revogáveis, listáveis |
| Recuperação de senha | ✅ | Token de uso único, revoga outras sessões |
| Verificação de e-mail | ✅ | Link com expiração de 24h |
| Convites | ✅ | Nominais, com expiração, entram nos canais públicos |
| Cargos e permissões | ✅ | 48 permissões, 14 cargos padrão editáveis |
| Onboarding | ✅ | Empresa, equipe e confirmação em 3 passos |
| Auditoria | ✅ | Append-only com diff, IP e severidade |
| Login social | 🟡 | Interface pronta; falta configurar provedor OAuth |
| 2FA | 🟡 | Campos e fluxo modelados; falta implementar TOTP |

## Fase 2 — Produto principal ✅

| Item | Estado | Observação |
| --- | --- | --- |
| Dashboard | ✅ | Dados reais do tenant, sem número inventado |
| Centro de produtividade ("Meu dia") | ✅ | Prioridades, agenda e blocos de foco |
| Chat | ✅ | Canais, diretas, threads, reações, menções, edição, moderação |
| Tempo real | ✅ | SSE escopado ao tenant pela sessão |
| Tarefas | ✅ | Lista, kanban com arrastar-soltar, checklist, comentários, histórico |
| Projetos | ✅ | Kanban próprio, equipe, canal automático, progresso calculado |
| Reuniões | ✅ | Agendamento, pauta, participantes, RSVP |
| Agenda | ✅ | Dia, semana, mês; reuniões, prazos e blocos unificados |
| Time blocking | ✅ | Arrastar tarefa para o horário cria bloco vinculado |
| Arquivos | ✅ | Upload por arrastar, cota do plano, download autenticado |
| Funcionários | ✅ | Tabela, perfil, alteração de cargo e desativação |
| Organograma | ✅ | Árvore recursiva com prevenção de ciclo |
| Departamentos e grupos | ✅ | CRUD completo |
| Avisos | ✅ | Público-alvo por empresa, departamento, grupo ou cargo |
| Notificações | ✅ | Central com filtros, persistidas + tempo real |
| Busca global | ✅ | 7 tipos de entidade, filtrada por permissão, com ⌘K |
| Vídeo e áudio na reunião | 🟡 | Campos e status modelados; falta WebRTC ou provedor |
| Gravação de reunião | 🟡 | Modelo `MeetingRecording` pronto; falta captura |
| Indicador de digitando | 🟡 | Evento existe no barramento; falta ligar na interface |
| Pastas de arquivo | 🟡 | Modelo e serviço prontos; falta navegação na interface |
| Timeline de projeto (Gantt) | ⬜ | Dependências já modeladas |

## Fase 3 — Inteligência ✅

| Item | Estado | Observação |
| --- | --- | --- |
| Extração de tarefas do texto | ✅ | Determinística, pt-BR, 29 testes cobrindo |
| Interpretação de prazo | ✅ | "sexta", "amanhã", "20/09", "em 3 dias"… |
| Identificação de responsável | ✅ | Recusa atribuir quando o nome é ambíguo |
| Mensagem → tarefa | ✅ | Com rastreabilidade de volta à mensagem |
| Reunião → resumo → decisões → tarefas | ✅ | Ciclo completo com aprovação humana |
| Assistente conversacional | ✅ | Contexto filtrado por permissão, fontes citadas |
| Integração com LLM | ✅ | `AI_PROVIDER=anthropic` (opcional; heurístico é o padrão) |
| Agentes autônomos | ⬜ | Fora do escopo atual por decisão de segurança |

## Fase 4 — Comercial ✅ / 🟡

| Item | Estado | Observação |
| --- | --- | --- |
| Catálogo de planos | ✅ | No banco, editável sem deploy |
| Página de planos e checkout | ✅ | Cartão, Pix e boleto |
| Controle de recursos por plano | ✅ | `requireEntitlement` no servidor |
| Limite de assentos | ✅ | Bloqueia convite acima do plano |
| Assinatura e faturas | ✅ | Upgrade, downgrade e cancelamento |
| Webhook de pagamento | ✅ | Idempotente, com verificação de assinatura |
| Gateway real | 🟡 | Interface `PaymentGateway` pronta; falta plugar adquirente |
| Nota fiscal | ⬜ | Exige integração com emissor |

## Fase 5 — Escala 🟡

| Item | Estado | Observação |
| --- | --- | --- |
| Healthcheck | ✅ | `/api/saude` verifica o banco de verdade |
| Docker e CI | ✅ | Build multi-estágio, usuário sem privilégio, GitHub Actions |
| Rate limiting | ✅ | Em memória; interface pronta para Redis |
| Paginação por cursor | ✅ | Chat, notificações e listas longas |
| Armazenamento S3 | 🟡 | `StorageDriver` pronto; falta implementar o driver |
| E-mail SMTP | 🟡 | `MailDriver` pronto; driver console é o padrão |
| Redis (cache, fila, pub/sub) | 🟡 | Interfaces `EventBus` e `RateLimiter` prontas |
| Painel do Platform Admin | 🟡 | Usuário e permissão existem; interface não |
| API pública e webhooks de saída | ⬜ | Entitlement `api.access` já definido |
| SSO / SAML / SCIM | ⬜ | Entitlement `sso` já definido |
| Integrações externas | 🟡 | Modelo `Integration` pronto; nenhum conector implementado |
| Observabilidade (traces, métricas) | ⬜ | Hoje apenas logs estruturados |
| Multi-idioma | ⬜ | Textos em pt-BR direto no código |

---

## Como retomar cada ponto 🟡

Cada item preparado tem um lugar exato para ser implementado:

| Item | Onde | O que fazer |
| --- | --- | --- |
| S3 | `src/lib/storage/index.ts` | Implementar `S3StorageDriver` com o SDK |
| SMTP | `src/lib/mail/index.ts` | Implementar `SmtpMailDriver` |
| Redis (eventos) | `src/lib/realtime/bus.ts` | Novo `RedisBus implements EventBus` |
| Redis (rate limit) | `src/lib/http/rate-limit.ts` | Novo `RedisRateLimiter implements RateLimiter` |
| Stripe | `src/lib/billing/gateway.ts` | Implementar `StripeGateway` |
| OAuth | `src/server/services/auth.service.ts` | Fluxo de callback + `User.passwordHash` nulo |
| 2FA | `src/lib/auth/` | TOTP usando `twoFactorSecret` já modelado |
| Integrações | `src/lib/integrations/` | Criar o módulo; modelo `Integration` já existe |

Nenhum desses exige mudança em quem chama — é exatamente esse o ponto de terem
sido modelados como interface desde o início.
