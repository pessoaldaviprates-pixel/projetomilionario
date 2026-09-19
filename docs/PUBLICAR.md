# Do banco até o ar

Passo a passo para sair do computador local e chegar num endereço que
qualquer pessoa abre. Feito para ser seguido **num computador** — a
parte do banco precisa de terminal.

Tudo aqui foi **testado de verdade** antes de ser escrito, num Postgres
de mentira mas real: `npm install`, `prisma migrate deploy`,
`npm run db:seed`, `npm run build` e `npm test`. Onde o resultado
importa, ele está anotado.

---

## O que já funciona (conferido, não prometido)

| conferência | resultado |
|---|---|
| `npm install` | passou |
| `npm test` | **76 testes, 7 arquivos, todos passaram** |
| TypeScript | passou |
| `npm run build` **sem banco** | **FALHA** — ver o aviso abaixo |
| `npm run build` **com banco migrado** | passou |
| `npm run db:seed` | passou (3 planos + empresa de demonstração) |

### O aviso que evita o erro da primeira vez

O build **não passa sem um banco que exista e já tenha as tabelas**.

O motivo: a página `/planos` é gerada durante o build e consulta a
tabela `Plan`. Sem banco alcançável, o build morre com
`PrismaClientKnownRequestError` e a mensagem não deixa óbvio que o
problema é esse.

Por isso a ordem aqui é **banco primeiro, deploy depois**. Não é
preferência — é obrigação.

---

## Passo 1 — O banco (10 minutos)

Qualquer Postgres hospedado serve. Os dois com plano grátis que
funcionam bem com a Vercel:

- **Neon** (`neon.com`) — mais simples, liga direto no GitHub
- **Supabase** (`supabase.com`) — mais completo, tem editor de SQL no site

1. Criar conta e criar um projeto
2. Copiar a **connection string** — começa com `postgresql://`
3. Guardar num lugar seguro. Ela dá acesso total ao banco

> **Neon:** use a string com `-pooler` no nome quando for para a Vercel.
> A Vercel abre e fecha muita conexão, e sem o pooler o banco recusa
> depois de um tanto delas.

## Passo 2 — Criar as tabelas e os planos

No seu computador, dentro da pasta do projeto:

```sh
npm install

# aponta para o banco novo (a string do Passo 1)
export DATABASE_URL="postgresql://...seu banco..."

npm run db:deploy    # cria as 47 tabelas
```

Agora os **planos**, que a tela de preços precisa para não vir vazia:

```sh
npm run db:seed
```

### ⚠ Leia antes de rodar o seed em produção

O `prisma/seed.ts` cria, com **senha escrita dentro do código**:

- `admin@nexora.app` — **administrador da plataforma** (manda em tudo)
- `gabriel@nexora.app` — empresa de demonstração com dados de exemplo

A senha dos dois é `Nexora@2026`, e **este repositório é público**:
qualquer pessoa abre o arquivo no GitHub e lê a senha.

Rodar o seed inteiro no banco de produção é **entregar a plataforma**.

Três saídas, da mais rápida para a melhor:

1. Rodar o seed e, **antes de divulgar o endereço**, entrar como
   `admin@nexora.app` e trocar a senha. Depois apagar a empresa de
   demonstração.
2. Rodar só a parte dos planos, comentando o resto do `seed.ts`.
3. Mudar o `DEMO_PASSWORD` e o e-mail do administrador antes de rodar —
   e não commitar a senha nova.

O seed **não pode rodar duas vezes**: ele usa `create` em 23 lugares e
`upsert` em só 3. Na segunda vez ele quebra por chave repetida. É por
isso que ele **não** entra no comando de build.

## Passo 3 — Conferir no seu computador antes de subir

```sh
export AUTH_SECRET="$(openssl rand -hex 32)"
npm run build
npm test
```

Se os dois passarem aqui, passam na Vercel. Se falharem, é **muito**
mais fácil consertar no seu terminal do que lendo log de deploy.

## Passo 4 — Vercel

1. `vercel.com` → entrar com o GitHub → **Add New Project**
2. Escolher `projetomilionario`
3. Em **Root Directory**, deixar como está
4. **Antes de apertar Deploy**, os dois ajustes abaixo

### 4a. Build Command — o passo que ninguém adivinha

Em *Build and Output Settings*, ligar o **Override** e pôr:

```
npx prisma migrate deploy && npm run build
```

É isso que aplica as migrações **antes** de buildar. Como
`migrate deploy` só aplica o que falta, pode rodar em todo deploy sem
medo — diferente do seed.

### 4b. As variáveis de ambiente

Obrigatórias — sem elas o app **nem sobe** (o `src/lib/env.ts` recusa):

| nome | valor |
|---|---|
| `DATABASE_URL` | a string do Passo 1 |
| `AUTH_SECRET` | 32+ caracteres aleatórios. Gere com `openssl rand -hex 32` |
| `APP_URL` | `https://seu-projeto.vercel.app` |

O `AUTH_SECRET` é a chave que assina as sessões. Em produção o código
**recusa** o valor de exemplo e qualquer coisa com menos de 32
caracteres — de propósito. Quem tiver essa chave entra como qualquer
pessoa.

O resto tem padrão e pode ficar de fora por enquanto.

5. **Deploy.** Uns 3 a 5 minutos.

---

## O que vai funcionar no link, e o que não vai

**Funciona:** criar conta, criar empresa, convidar gente, chat com
canais e diretas, tarefas, kanban, projetos, reuniões, agenda,
organograma, avisos, notificações, busca global.

**Não funciona ainda — e é esperado, não é defeito:**

| o quê | por quê | onde conserta |
|---|---|---|
| E-mail não chega | `MAIL_DRIVER=console` — o e-mail só aparece no log | `src/lib/mail/index.ts` |
| Upload se perde | `STORAGE_DRIVER=local` grava em disco, e **a Vercel apaga o disco a cada deploy** | `src/lib/storage/index.ts` |
| Pagamento não cobra | `BILLING_PROVIDER=manual` | `src/lib/billing/gateway.ts` |

O e-mail é o mais urgente dos três: **sem ele ninguém confirma conta
nem recupera senha**. Quem esquecer a senha perde o acesso para sempre.

---

## Depois do link: a ordem que eu seguiria

**1. E-mail** (meio dia) — conta no **Resend** (grátis até 3.000/mês),
implementar `SmtpMailDriver`. Destrava cadastro e recuperação de senha.

**2. Arquivos** (um dia) — **Cloudflare R2** (grátis até 10 GB),
implementar `S3StorageDriver`. Sem isso todo upload some no deploy
seguinte.

**3. Gente de verdade usando** (uma semana) — mais valioso que qualquer
funcionalidade nova. É aqui que aparece o que ninguém previu.

**4. Pagamento** (uma a duas semanas de código, mais a papelada)

A sua tela de checkout promete **cartão, Pix e boleto**. O **Stripe não
entrega isso no Brasil** — Pix é restrito e boleto saiu. Para cumprir o
que a tela promete, o caminho é um adquirente brasileiro: **Mercado
Pago**, **Asaas** ou **Pagar.me**.

> **O que costuma estourar o prazo não é o código: é o CNPJ.** Todo
> adquirente sério pede para liberar recebimento. Se você ainda não tem,
> isso pode demorar mais que o resto junto.
>
> Por isso: **não deixe o pagamento travar o lançamento.** Publique com
> o plano gratuito liberado, deixe gente usar, e ligue a cobrança quando
> a conta sair. Produto que ninguém usou ainda não sabe o preço que
> vale.

**5. Instalar na tela inicial** (meio dia) — `manifest.json` + service
worker. Qualquer endereço `https://` pode virar app na tela de início;
não precisa de loja nem de GitHub Pages.

---

## Antes de divulgar o endereço

- [ ] `admin@nexora.app` com senha trocada (ou apagado)
- [ ] empresa de demonstração apagada
- [ ] `AUTH_SECRET` de produção **diferente** do que você usou em teste
- [ ] nenhuma chave dentro do código — só nas variáveis da Vercel
- [ ] e-mail funcionando (senão ninguém recupera a conta)
- [ ] política de privacidade e termos — **com pagamento vira obrigação**
- [ ] entrar no link de um celular que nunca abriu o sistema

---

## Quando der erro

O log de deploy da Vercel diz a verdade, mas enterrada. Os três mais
prováveis:

| mensagem | o que é |
|---|---|
| `Variável de ambiente obrigatória ausente: DATABASE_URL` | faltou a variável, ou tem espaço sobrando |
| `AUTH_SECRET inseguro em produção` | menos de 32 caracteres, ou ainda é o de exemplo |
| `PrismaClientKnownRequestError` durante o build | o banco não responde, ou as tabelas não existem — reveja o Build Command do Passo 4a |
