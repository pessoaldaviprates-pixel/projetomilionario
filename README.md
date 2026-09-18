<div align="center">

# Nexora

**Pessoas + Processos + Resultados**

Plataforma SaaS B2B que reúne comunicação, tarefas, projetos, reuniões, agenda,
arquivos e inteligência artificial em um único ambiente corporativo.

</div>

---

## O que é

A Nexora não é uma coleção de ferramentas independentes. É um sistema em que os
módulos conversam entre si, guiado por um princípio:

```
COMUNICAÇÃO → DECISÃO → TAREFA → PRAZO → EXECUÇÃO
```

Na prática, isso significa que:

- uma mensagem no chat pode virar tarefa com responsável e prazo;
- uma reunião vira transcrição → resumo → decisões → itens de ação → tarefas;
- uma tarefa com prazo aparece automaticamente na agenda de quem é responsável;
- um projeto nasce já com o canal de conversa dele;
- um arquivo enviado a um projeto aparece dentro daquele projeto.

A inteligência **propõe**; a pessoa **aprova**. Nada é criado sem confirmação.

## Começando

### Com Docker (recomendado)

```bash
cp .env.example .env
# Gere um segredo real antes de subir:
echo "AUTH_SECRET=\"$(openssl rand -base64 48)\"" >> .env

docker compose up -d
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run db:seed
```

Acesse <http://localhost:3000>.

### Localmente

Requisitos: Node.js 20+ e PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # ajuste DATABASE_URL e AUTH_SECRET
npm run db:migrate
npm run db:seed
npm run dev
```

### Acessos de demonstração

O seed cria a empresa **Nexora Demonstração** com 8 pessoas, projetos, tarefas,
conversas e uma reunião já processada pela IA.

| Perfil | E-mail | Senha |
| --- | --- | --- |
| CEO (acesso total) | `gabriel@nexora.app` | `Nexora@2026` |
| CTO | `lucas@nexora.app` | `Nexora@2026` |
| Desenvolvedor | `rafael@nexora.app` | `Nexora@2026` |
| Admin da plataforma | `admin@nexora.app` | `Nexora@2026` |

> Entre com perfis diferentes para ver o sistema de permissões em ação: o
> desenvolvedor não enxerga o painel administrativo nem os dados financeiros.

## Stack

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Frontend | Next.js 16 (App Router) + React 19 | Server Components reduzem JavaScript no cliente; o mesmo processo serve UI e API |
| Linguagem | TypeScript estrito | Erro de tipo em tempo de compilação, não em produção |
| Estilo | Tailwind CSS v4 | Tokens de design no CSS, sem runtime |
| Banco | PostgreSQL 16 + Prisma 7 | Relacional com integridade referencial; o modelo é fortemente relacional |
| Sessão | Opaca em banco | Revogação imediata — desligar alguém corta o acesso na hora |
| Tempo real | SSE | O tráfego é servidor→cliente; passa por qualquer proxy, sem servidor extra |
| Testes | Vitest | Rápido, mesma configuração de módulos do projeto |

## Comandos

```bash
npm run dev          # desenvolvimento
npm run build        # build de produção
npm run typecheck    # verificação de tipos
npm test             # suíte de testes
npm run db:migrate   # aplicar migrações (dev)
npm run db:deploy    # aplicar migrações (produção)
npm run db:seed      # popular dados de demonstração
npm run db:studio    # inspecionar o banco
```

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Decisões técnicas, camadas, fluxo de uma requisição |
| [docs/BANCO-DE-DADOS.md](docs/BANCO-DE-DADOS.md) | Entidades, relacionamentos e índices |
| [docs/SEGURANCA.md](docs/SEGURANCA.md) | Modelo de ameaças e controles implementados |
| [docs/ROADMAP.md](docs/ROADMAP.md) | O que está pronto, o que falta e o que vem depois |

## Estado do projeto

Esta é uma base de MVP funcional, não uma demonstração estática. O que está
implementado tem lógica real: autenticação, isolamento entre empresas,
permissões, chat, tarefas, projetos, reuniões, agenda, arquivos, avisos, IA,
assinatura e auditoria funcionam ponta a ponta contra o banco.

O que ainda não existe está registrado explicitamente no
[ROADMAP](docs/ROADMAP.md) — inclusive os pontos onde a arquitetura já está
preparada mas a integração externa falta (vídeo, S3, SMTP, gateway de pagamento).

## Licença

Projeto proprietário. Todos os direitos reservados.
