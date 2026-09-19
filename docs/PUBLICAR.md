# Publicar

## O link

1. **neon.com** → entrar com o GitHub → criar projeto → copiar a linha
   que começa com `postgresql://`

2. No seu computador, na pasta do projeto:

```sh
npm install
export DATABASE_URL="a linha que você copiou"
npm run db:deploy
npm run db:seed
```

3. **vercel.com** → Add New Project → escolher `projetomilionario`

4. Antes de apertar Deploy, duas coisas:

**Build Command** (ligar o Override):

```
npx prisma migrate deploy && npm run build
```

**Variáveis:**

| nome | valor |
|---|---|
| `DATABASE_URL` | a mesma linha |
| `AUTH_SECRET` | gere com `openssl rand -hex 32` |
| `APP_URL` | o endereço que a Vercel te der |

5. Deploy. Sai o link.

---

## Antes de mandar o link para alguém

**Troque a senha do `admin@nexora.app`.**

O `prisma/seed.ts` cria esse usuário — o dono de tudo — com a senha
`Nexora@2026` escrita dentro do arquivo. O repositório é público:
qualquer pessoa lê e entra como dono.

Entre com ela e troque. Apague também a empresa de demonstração.

**Não ponha o `AUTH_SECRET` em arquivo nenhum.** Ele mora só nas
variáveis da Vercel. Se vazar, dá para entrar como qualquer usuário.

---

## Depois, sem pressa

- 2FA no seu GitHub e na sua Vercel
- backup ligado no Neon
- **e-mail**: hoje não sai nenhum (`MAIL_DRIVER=console`). Quem esquecer
  a senha perde a conta. Meio dia de trabalho com o Resend

---

## Perguntas que aparecem

**"O build falhou com erro do Prisma"** — o banco não existe ou está sem
tabelas. A tela de preços é montada durante o build e precisa do banco
pronto. Volte ao passo 2.

**"Rodei o `db:seed` de novo e quebrou"** — ele só roda uma vez, por
isso não está no Build Command. O `db:deploy` pode repetir à vontade.

**"O upload some"** — a Vercel apaga o disco a cada deploy. Some mesmo,
até trocar `STORAGE_DRIVER`.

**"O pagamento não cobra"** — `BILLING_PROVIDER=manual`. Ainda não está
ligado em nada.
