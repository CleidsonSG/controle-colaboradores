# Supabase: configuração e teste local

Com as variáveis do Supabase definidas, o sistema exige login **e aprovação** e grava os dados importados e o teto da folha no Supabase.
Sem elas, tudo continua funcionando só no navegador (IndexedDB), sem login.

## Como funciona o acesso

1. A pessoa clica em **Solicitar acesso** na tela de entrada e informa nome, e-mail e senha.
2. Confirma o e-mail pelo link que o Supabase envia.
3. Ao entrar, vê **Aguardando aprovação**. Nenhum dado aparece.
4. Um administrador abre **Usuários** no menu e clica em **Aprovar** (ou **Bloquear**).
5. Aprovada, a pessoa vê o sistema ao clicar em **Verificar de novo** ou entrar novamente.

As regras do banco garantem isso: só perfis **aprovados** leem ou gravam dados; só **administradores** alteram perfis;
ninguém altera o próprio acesso. Uma conta criada fora da tela (usando a chave pública) também nasce pendente.

## 1. Criar seu usuário primeiro (uma vez)

Em **Authentication > Users > Add user > Create new user**, crie o seu usuário (marque **Auto Confirm User**).
Faça isso **antes** do passo 2: quem já existe quando o script roda fica aprovado, e o usuário mais antigo vira o primeiro administrador.

## 2. Criar as tabelas e regras

1. No painel do Supabase, abra **SQL Editor > New query**.
2. Cole o conteúdo de [`supabase/schema.sql`](../supabase/schema.sql) e clique em **Run**.

O script pode ser executado de novo sempre que o arquivo mudar: ele não apaga dados nem altera perfis já existentes.

Se você criou seu usuário depois do script, rode o script de novo (ele aprova os usuários sem perfil e, se não houver administrador, promove o mais antigo).
Para promover alguém manualmente, no SQL Editor:

```sql
update public.perfis set status = 'aprovado', papel = 'admin' where email = 'email-da-pessoa@exemplo.com';
```

## 3. Cadastro e e-mails

- **Authentication > Sign In / Providers**: deixe **Allow new users to sign up** **ligado** (é o que permite a tela Solicitar acesso)
  e **Confirm email** ligado.
- **Authentication > URL Configuration**:
  - **Site URL**: o endereço do site publicado (ex.: `https://cleidsonsg.github.io/controle-colaboradores/`).
  - **Redirect URLs**: adicione também `http://localhost:3000/**` para os testes no computador.
- O e-mail padrão do Supabase tem limite baixo de envios por hora. Para muitos pedidos, configure um SMTP próprio em
  **Authentication > Emails > SMTP Settings**.

## 4. Testar no computador

1. Copie `.env.example` para `.env.local` e preencha com **Project Settings > API**: Project URL e a chave `anon` `public`.
   Nunca use a chave `service_role`.
2. `npm install` e `npm run dev`, e abra o endereço mostrado no terminal.
3. Entre com o seu usuário e importe os arquivos (os dados antigos do navegador não são copiados).
4. Para testar o pedido de acesso, use outro navegador (ou janela anônima), clique em **Solicitar acesso** e aprove pela tela **Usuários**.

## 5. Site publicado (GitHub Pages)

O workflow já lê as variáveis do repositório: **Settings > Secrets and variables > Actions > Variables**,
`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Com elas preenchidas, o site publicado passa a exigir login.

## Voltar ao ponto anterior

O estado antes do Supabase está na branch `ponto-antes-supabase`.
