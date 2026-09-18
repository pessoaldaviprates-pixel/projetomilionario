# Segurança

Este documento descreve o que está implementado, **e também o que não está** —
saber onde estão os limites é parte do controle.

## Modelo de ameaças

As ameaças que orientaram as decisões, em ordem de gravidade:

1. **Vazamento entre empresas** — uma empresa alcançar dados de outra. É a
   falha mais grave possível num SaaS B2B.
2. **Escalonamento de privilégio** — funcionário obter permissão que o cargo
   não concede.
3. **Sequestro de sessão** — reutilizar credencial ou token roubado.
4. **Enumeração de contas** — descobrir quem é cliente pela resposta do login.
5. **Upload malicioso** — arquivo que executa no contexto da aplicação.
6. **Abuso automatizado** — força bruta e flood de requisições.

## Controles

### 1. Isolamento entre empresas

| Controle | Implementação |
| --- | --- |
| Tenant resolvido no servidor | `getAuthContext()` lê da sessão; o cliente nunca informa `companyId` |
| Escopo obrigatório | `scoped(ctx)` / `scopedId(ctx, id)` — única forma de montar `where` |
| Rede de segurança | `assertTenant()` valida registros já carregados |
| Resposta neutra | Recurso de outro tenant devolve **404**, não 403 |
| Integridade no banco | `onDelete` explícito em toda relação; cascata por empresa |
| Verificação automatizada | 10 testes de integração contra o banco real |

### 2. Autenticação

| Controle | Implementação |
| --- | --- |
| Hash de senha | bcrypt, custo 12, salt por senha |
| Política de senha | mínimo 8 caracteres, maiúscula, minúscula e número |
| Sessão | token opaco de 32 bytes; o banco guarda apenas SHA-256 |
| Cookie | `httpOnly`, `sameSite=lax`, `secure` em produção |
| Revogação | imediata — desativar alguém derruba as sessões na hora |
| Bloqueio progressivo | 5 falhas travam a conta por 15 minutos |
| Enumeração | login, cadastro e recuperação respondem de forma idêntica |
| Timing | comparação de senha com custo equivalente mesmo sem hash |
| Troca de senha | revoga todas as outras sessões |
| Tokens de e-mail | uso único, com expiração, apenas hash no banco |
| 2FA | campos e fluxo modelados; ativação ainda não implementada |

### 3. Autorização

- 48 permissões granulares; cargos totalmente editáveis pelo administrador.
- Permissão desconhecida é **descartada** antes de gravar
  (`sanitizePermissions`) — não é possível injetar chave inventada.
- Alterar permissões exige `permissions.manage`, separada de `roles.manage`.
- O proprietário da empresa não pode ser rebaixado nem desativado por outra
  pessoa — sem isso, um administrador poderia tomar a empresa.
- Cargo inativo não concede nada: é a forma de suspender acesso sem apagar
  histórico.

### 4. Entrada de dados

- **Toda** entrada passa por schema zod antes de tocar no banco.
- Limites de tamanho em todo campo de texto — evita exaustão de memória.
- Prisma usa consultas parametrizadas: injeção de SQL não se aplica.
- React escapa conteúdo por padrão; não há `dangerouslySetInnerHTML` no projeto.

### 5. Upload e download de arquivos

| Risco | Controle |
| --- | --- |
| Path traversal | chave gerada pelo servidor; nome do usuário nunca vira caminho; `resolve` validado contra a raiz |
| Executáveis | allowlist de MIME **e** blocklist de extensão |
| XSS armazenado | `.html`, `.svg` e afins bloqueados; download sempre `attachment` + `nosniff` |
| Acesso indevido | download passa por rota autenticada que revalida tenant, visibilidade e permissão |
| Exaustão de disco | limite por arquivo e cota por plano |

Não existe URL pública adivinhável para arquivo algum.

### 6. Rate limiting

| Ação | Limite |
| --- | --- |
| Login | 8 / 15 min por IP |
| Cadastro | 5 / hora por IP |
| Recuperação de senha | 5 / hora por IP |
| Mensagens | 60 / min por pessoa |
| Upload | 30 / min por pessoa |
| IA | 30 / min por pessoa |
| Mutações gerais | 120 / min por pessoa |

### 7. Cabeçalhos HTTP

Aplicados a toda resposta em `next.config.ts`:

`Content-Security-Policy` · `Strict-Transport-Security` ·
`X-Content-Type-Options: nosniff` · `X-Frame-Options: DENY` ·
`Referrer-Policy: strict-origin-when-cross-origin` · `Permissions-Policy`

### 8. Pagamentos

- Nenhum dado sensível de cartão trafega ou é armazenado.
- O servidor recebe no máximo um **token opaco** do gateway; guardamos apenas
  bandeira e 4 últimos dígitos, que são dados de exibição.
- Webhook verifica assinatura **antes** de ler o corpo e é idempotente: a
  mesma entrega processada duas vezes não cobra nem libera duas vezes.

### 9. Segredos

- Lidos exclusivamente de variáveis de ambiente.
- `src/lib/env.ts` é `server-only`: qualquer import acidental em componente
  cliente **quebra o build** — esse guarda já capturou um vazamento real
  durante o desenvolvimento.
- Em produção, a aplicação **recusa iniciar** com `AUTH_SECRET` padrão ou com
  menos de 32 bytes.

### 10. Auditoria

Trilha append-only com ator, ação, entidade, diff, IP, user agent e severidade.
Falha ao gravar auditoria nunca derruba a operação de negócio — perder a ação
do usuário seria pior que perder a linha de log.

## Limitações conhecidas

Assumidas conscientemente neste estágio:

| Limitação | Impacto | Caminho |
| --- | --- | --- |
| Rate limit em memória | Não compartilhado entre instâncias | Adaptador Redis (interface pronta) |
| CSP com `unsafe-inline` em estilo | Reduz proteção contra XSS de estilo | Nonce por requisição |
| Sem verificação antivírus no upload | Arquivo infectado pode ser armazenado | Integrar ClamAV ou serviço externo |
| 2FA não ativável | Conta depende só da senha | Implementar TOTP (modelo já existe) |
| Sem SSO/SAML | Empresas grandes não integram seu IdP | Previsto na fase 5 |
| Credenciais de integração | Campo existe, cifragem não implementada | AES-256-GCM com `AUTH_SECRET` |
| Sem rotação de segredo | Troca exige reinício | Versionamento de chave |

## Resposta a incidentes

Se houver suspeita de comprometimento:

1. **Revogar sessões**
   `UPDATE sessions SET "revokedAt" = now() WHERE "revokedAt" IS NULL;`
2. **Rotacionar `AUTH_SECRET`** e reiniciar (invalida tokens pendentes).
3. **Auditar**: `/admin/seguranca`, filtrando por severidade crítica.
4. **Verificar acessos**: tabela `audit_logs`, ações `auth.login_failed` e
   `member.role_changed`.
5. **Forçar troca de senha** dos usuários afetados.

## Divulgação responsável

Encontrou uma vulnerabilidade? Relate em particular, com passos de reprodução,
antes de qualquer divulgação pública.
