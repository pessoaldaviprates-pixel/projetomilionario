# Do zero até no ar, com segurança

Um caminho só, na ordem. Cada passo explica **por que** existe — porque
quando você entender o porquê, vai saber decidir sozinho quando algo
fugir do escrito.

Tudo aqui foi testado contra um Postgres de verdade antes de ser
escrito: `npm install`, as migrações, o seed, o build e os 76 testes.
Onde o resultado importa, ele está anotado.

---

# Parte 1 — O banco e o link

## Por que o banco vem primeiro

Parece natural publicar o site e depois ligar o banco. **Aqui isso não
funciona, e o erro que aparece não explica o motivo.**

A página de preços (`/planos`) é montada **durante o build**, não quando
alguém abre. Para montá-la, o Next.js pergunta ao banco quais planos
existem. Se o banco não existir, ou existir mas estiver vazio de
tabelas, o build morre com `PrismaClientKnownRequestError` — uma
mensagem que não diz "faltou o banco".

Por isso a ordem é: **banco → tabelas → site**. Não é preferência, é a
única ordem que funciona.

## Passo 1 — Criar o banco

Vá em **neon.com**, entre com o GitHub e crie um projeto.

Copie a **connection string**. Ela começa com `postgresql://` e parece
isto:

```
postgresql://usuario:senha@ep-algo-123.sa-east-1.aws.neon.tech/neondb?sslmode=require
```

Duas coisas sobre ela:

**Ela é uma senha.** Quem tiver essa linha lê, muda e apaga tudo — de
todas as empresas clientes. Nunca mande por WhatsApp, nunca ponha num
arquivo que vá para o GitHub.

**Escolha a versão com `-pooler` no endereço**, se o Neon oferecer. A
Vercel abre e fecha conexão o tempo todo, e sem o pooler o banco começa
a recusar depois de um tanto delas — o sintoma é o site funcionar e de
repente dar erro sem motivo aparente.

## Passo 2 — Criar as tabelas

No seu computador, dentro da pasta do projeto:

```sh
npm install

export DATABASE_URL="postgresql://...a sua string..."

npm run db:deploy
```

Isso cria as 47 tabelas. Demora poucos segundos.

`db:deploy` só aplica o que falta. Rodar de novo não quebra nada nem
apaga nada — é seguro repetir sempre.

## Passo 3 — Criar os planos

A tela de preços lê os planos do banco. Sem isso ela vem vazia.

**Antes de rodar, leia a Parte 3 deste documento.** O comando abaixo
cria um administrador da plataforma com senha que está escrita no código
— e o seu repositório é público. Rodar isso sem entender é o jeito mais
rápido de entregar o sistema.

```sh
npm run db:seed
```

Ele cria: os 3 planos, um administrador da plataforma
(`admin@nexora.app`) e uma empresa de demonstração com dados de
exemplo.

Só pode rodar **uma vez**. Ele usa `create` em 23 lugares e `upsert` em
só 3, então na segunda vez quebra por chave repetida. É por isso que ele
**não** entra no comando de build.

## Passo 4 — Conferir antes de subir

```sh
export AUTH_SECRET="$(openssl rand -hex 32)"
npm run build
npm test
```

Se passarem aqui, passam na Vercel. Se falharem, consertar no seu
terminal é muito mais fácil do que garimpar log de deploy.

Resultado esperado: build com sucesso e **76 testes passando**.

## Passo 5 — Vercel

1. **vercel.com** → entrar com o GitHub → **Add New Project**
2. Escolher `projetomilionario`
3. **Não apertar Deploy ainda** — faltam dois ajustes

### 5a. O Build Command

Em *Build and Output Settings*, ligue o **Override** e ponha:

```
npx prisma migrate deploy && npm run build
```

**Por que:** toda vez que você publicar uma versão nova que mexeu no
banco, as tabelas precisam ser atualizadas antes do site subir. Essa
linha faz isso sozinha. Como `migrate deploy` só aplica o que falta,
pode rodar em todo deploy sem risco.

O seed **não** entra aqui — ele não pode repetir.

### 5b. As variáveis de ambiente

| nome | valor |
|---|---|
| `DATABASE_URL` | a string do Passo 1 |
| `AUTH_SECRET` | gere com `openssl rand -hex 32` |
| `APP_URL` | `https://seu-projeto.vercel.app` |

Sem as duas primeiras o app **nem sobe** — o `src/lib/env.ts` recusa
iniciar, de propósito.

**O que é o `AUTH_SECRET`:** é a chave que assina as sessões. Quando
alguém entra, o servidor cria um crachá e assina com ela. Se você mudar
a chave, todo mundo cai e precisa entrar de novo. **Se ela vazar,
qualquer pessoa consegue fabricar um crachá de qualquer usuário** — e
não existe aviso, não existe log, não dá para perceber.

Trate ela como a chave do cofre.

4. **Deploy.** Três a cinco minutos.

---

# Parte 2 — O que já está seguro (e você não precisa mexer)

Antes da lista do que fazer, vale saber o que **já está bem feito**.
Isso importa: segurança é onde a gente se cansa, e saber onde não
precisa olhar economiza a energia para onde precisa.

## As senhas estão guardadas do jeito certo

Ninguém guarda senha. O que fica no banco é um **hash** — um resultado
matemático que não tem volta. O sistema usa **bcrypt com custo 12**.

O "custo 12" quer dizer que calcular um hash é **deliberadamente lento**
(uns 250 milissegundos). Para você entrar, um quarto de segundo não faz
diferença. Para quem roubou o banco e quer testar bilhões de senhas, é a
diferença entre horas e séculos.

**Na prática:** se alguém roubar o seu banco inteiro, as senhas dos seus
clientes continuam protegidas. É a coisa mais importante desta lista.

## Cada senha tem um tempero diferente

Duas pessoas com a senha `123456` geram hashes **diferentes** no banco.
Isso impede o ataque clássico de olhar quais usuários têm a mesma senha,
e impede tabelas prontas de consulta. Tem teste cobrindo isso.

## A sessão não dá para roubar do banco

O crachá de sessão é gerado com aleatoriedade de verdade
(`randomBytes`) e o banco guarda **só o hash dele**. Quem roubar o banco
leva os hashes — e hash de sessão não serve para entrar.

## O cookie está trancado

```
httpOnly: true    → JavaScript da página não consegue ler o cookie
sameSite: 'lax'   → outro site não consegue usar o seu cookie
secure: produção  → só trafega por https
```

O `httpOnly` é o que impede o ataque mais comum da web: alguém injeta um
script na página e manda o seu cookie embora. Com ele ligado, o script
não enxerga o cookie.

## A conta trava sozinha depois de erros

Quem erra a senha várias vezes tem a conta bloqueada por um tempo
(`failedLoginCount` e `lockedUntil`). E — isto é o detalhe que muita
gente erra — **esse controle fica no banco**, não na memória do
servidor. Então funciona mesmo com a Vercel ligando e desligando
servidores o tempo todo.

É essa a defesa que realmente protege contra alguém ficar tentando
senhas da sua conta.

## Não dá para descobrir quais e-mails existem

Quando alguém tenta entrar com um e-mail que não existe, o sistema
**gasta o mesmo tempo** que gastaria com um que existe. Sem isso, dava
para descobrir a lista de clientes cronometrando as respostas. Esse
cuidado está escrito no código, de propósito.

---

# Parte 3 — O que VOCÊ precisa fazer

O código está bem feito. **Os riscos que sobraram são todos
operacionais** — coisas fora do código, que só você pode resolver.

Estão em ordem de quanto machucam.

## 1. O administrador da plataforma com senha pública 🔴

**Este é o mais grave, e é grave de verdade.**

O `prisma/seed.ts` cria o usuário `admin@nexora.app` — o
**administrador da plataforma**, que manda em todas as empresas — com a
senha `Nexora@2026`. Essa senha está **escrita dentro do arquivo**.

E o seu repositório é **público**. Qualquer pessoa no mundo abre
`prisma/seed.ts` no GitHub e lê a senha.

Se você rodar o seed em produção e não fizer nada, **o seu sistema está
aberto** — não "vulnerável", aberto. É só digitar.

**O que fazer, e faça antes de mandar o link para qualquer pessoa:**

1. Entre como `admin@nexora.app` com `Nexora@2026`
2. Troque a senha por uma longa e única
3. Apague a empresa de demonstração e o usuário `gabriel@nexora.app`
4. Se puder, troque também o e-mail do administrador — porque o endereço
   também é público

**Melhor ainda:** antes de rodar o seed em produção, abra o
`prisma/seed.ts`, mude o `DEMO_PASSWORD` e o e-mail do administrador, e
**não commite** essa mudança.

## 2. O `AUTH_SECRET` 🔴

**Nunca** ponha num arquivo que vá para o GitHub. Ele mora só nas
variáveis da Vercel.

**Use um diferente do que usou para testar.** Se um dia o de teste
aparecer num log, numa captura de tela ou numa conversa, o de produção
continua intacto.

Se desconfiar que vazou: gere outro e troque na Vercel. Todo mundo cai
da sessão e entra de novo — chato por cinco minutos, e resolve.

## 3. O banco só aceita quem você deixar 🟠

No painel do Neon, procure as restrições de rede (*IP Allow*).

Por padrão, quem tiver a connection string conecta **de qualquer lugar
do mundo**. Se der para limitar aos endereços da Vercel, limite. É uma
tranca a mais para o caso de a string vazar.

## 4. Ligue o backup e teste a volta 🟠

"Ser invadido" inclui **perder tudo**. Pode ser um ataque, pode ser um
comando errado seu às duas da manhã.

O Neon tem restauração para um ponto no tempo. Ligue e escolha o maior
período que o seu plano permitir.

**E teste restaurar uma vez.** Backup que ninguém nunca restaurou não é
backup — é esperança. Você só descobre que não funciona no dia em que
precisa.

## 5. Proteja a sua própria conta 🟠

Você é o alvo mais valioso do sistema: quem entra como você entra em
tudo.

- **GitHub com 2FA ligado.** Se invadirem o seu GitHub, mudam o código e
  a Vercel publica sozinha.
- **Vercel com 2FA ligado.** Lá dentro estão o `AUTH_SECRET` e o
  `DATABASE_URL` à mostra.
- **Senha diferente em cada um.** Use um gerenciador de senhas.

De nada adianta bcrypt custo 12 se alguém entra pelo seu e-mail.

## 6. Nunca ponha segredo no código 🟠

A regra: **se está no repositório, considere público.** Repositório
privado vira público por engano, e o histórico do Git guarda tudo — até
o que você apagou depois.

Segredo mora **só** nas variáveis de ambiente da Vercel.

Antes de cada `git push`, olhe o que está indo. Se enxergar algo que
parece chave, senha ou string de conexão, **pare**.

## 7. Depois do lançamento: 2FA para os clientes 🟡

O `ROADMAP.md` marca o 2FA como preparado mas não implementado — o campo
`twoFactorSecret` já existe no banco.

É a **maior melhoria de segurança que ainda cabe**, e a que empresa
grande pergunta na primeira reunião. Não precisa estar pronto no
lançamento, mas ponha na lista logo depois.

## 8. Depois do lançamento: limitador compartilhado 🟡

O limitador de tentativas hoje é **em memória**. Na Vercel, cada
servidor tem a memória dele, e eles nascem e morrem o tempo todo — então
o limite vale menos do que parece.

Isso **não** é urgente, porque a defesa que importa (o bloqueio da conta
por senha errada) está no banco e funciona certo. Mas quando o sistema
crescer, troque por **Upstash Redis** — a interface `RateLimiter` já foi
escrita para isso, é trocar a implementação sem mexer em quem chama.

---

# A lista final, antes de mandar o link para alguém

- [ ] Banco criado e migrado
- [ ] `admin@nexora.app` com senha trocada — ou apagado
- [ ] Empresa de demonstração apagada
- [ ] `AUTH_SECRET` de produção, diferente do de teste, só na Vercel
- [ ] Nenhuma chave ou senha dentro do repositório
- [ ] Backup ligado no Neon, e restaurado uma vez para testar
- [ ] 2FA no seu GitHub e na sua Vercel
- [ ] Entrar no link de um celular que nunca abriu o sistema

---

# O que ainda não funciona no link (e não é defeito)

| o quê | por quê | onde se conserta |
|---|---|---|
| E-mail não chega | `MAIL_DRIVER=console` — só escreve no log | `src/lib/mail/index.ts` |
| Upload se perde | `STORAGE_DRIVER=local`, e a Vercel apaga o disco a cada deploy | `src/lib/storage/index.ts` |
| Pagamento não cobra | `BILLING_PROVIDER=manual` | `src/lib/billing/gateway.ts` |

**O e-mail é o mais urgente dos três.** Sem ele ninguém confirma conta
nem recupera senha — quem esquecer a senha perde o acesso para sempre.
Meio dia de trabalho com o **Resend** (grátis até 3.000 por mês).
