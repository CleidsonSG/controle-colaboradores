# Supabase: configuração e teste local

Com as variáveis do Supabase definidas, o sistema exige login **e aprovação** e grava os dados importados e o teto da folha no Supabase.
Sem elas, tudo continua funcionando só no navegador (IndexedDB), sem login.

## Como funciona o acesso

1. A pessoa clica em **Solicitar acesso** na tela de entrada e informa nome, e-mail e senha.
2. Confirma o e-mail pelo link que o Supabase envia.
3. Ao entrar, vê **Aguardando aprovação**. Nenhum dado aparece.
4. Um administrador abre **Configurações > Gestão de usuários** e clica em **Aprovar** (ou **Recusar**).
5. Aprovada, a pessoa vê o sistema ao clicar em **Verificar de novo** ou entrar novamente.

Na mesma tela o administrador também:
- muda o **perfil** (Usuário ou Administrador) de quem já está aprovado;
- **convida** pessoas: informa o e-mail e o perfil; o próprio Supabase envia o **e-mail de convite**. A pessoa abre o link, cria a senha
  na tela **Criar senha nova** e entra já aprovada com o perfil escolhido. O convite é enviado pela Edge Function `convidar-usuario` (passo 3),
  que confere no servidor se quem pede é administrador. Se o e-mail já tem conta, a tela avisa: aprove ou recuse a pessoa em **Usuários**.
  Quem se cadastra sozinho por **Solicitar acesso**, mesmo com um e-mail convidado, fica pendente como qualquer outro;
- envia **link de nova senha** (aba Reset de senha). A pessoa também pode usar **Esqueci minha senha** na tela de entrada.

As regras do banco garantem isso: só perfis **aprovados** leem os dados; só **administradores** importam, alteram ou apagam dados
e o teto da folha, alteram perfis e convidam; ninguém altera o próprio acesso. Uma conta criada fora da tela (usando a chave pública) também nasce pendente.

## 1. Criar seu usuário primeiro (uma vez)

Em **Authentication > Users > Add user > Create new user**, crie o seu usuário (marque **Auto Confirm User**).
Faça isso **antes** do passo 2: quem já existe quando o script roda fica aprovado, e o usuário mais antigo vira o primeiro administrador.

## 2. Criar as tabelas e regras

1. No painel do Supabase, abra **SQL Editor > New query**.
2. Cole o conteúdo de [`supabase/schema.sql`](../supabase/schema.sql) e clique em **Run**.

O script pode ser executado de novo sempre que o arquivo mudar: ele não apaga dados nem altera perfis já existentes.
**Sempre que `supabase/schema.sql` mudar (ex.: atualização de 2026-11-17, convites por e-mail e gravação só por administradores),
rode-o de novo inteiro** do mesmo jeito.

Se você criou seu usuário depois do script, rode o script de novo (ele aprova os usuários sem perfil e, se não houver administrador, promove o mais antigo).
Para promover alguém manualmente, no SQL Editor:

```sql
update public.perfis set status = 'aprovado', papel = 'admin' where email = 'email-da-pessoa@exemplo.com';
```

## 3. Implantar a função de convite (`convidar-usuario`)

O botão **Convidar usuário** chama a Edge Function `supabase/functions/convidar-usuario/index.ts`. Ela roda no Supabase e usa a
chave secreta que o próprio Supabase injeta no ambiente da função (nada a configurar; a chave nunca vai para o site).

**Pelo painel (sem instalar nada):**
1. Abra **Edge Functions > Deploy a new function > Via Editor**.
2. Nome da função: `convidar-usuario` (exatamente assim).
3. Apague o exemplo, cole o conteúdo inteiro de [`supabase/functions/convidar-usuario/index.ts`](../supabase/functions/convidar-usuario/index.ts) e clique em **Deploy function**.
4. Em **Edge Functions > convidar-usuario > Details**, confira que **Verify JWT** (Enforce JWT verification) está **ligado**.

**Alternativa pelo terminal** (exige login no navegador uma vez):

```powershell
npx supabase login
npx supabase functions deploy convidar-usuario --project-ref epvrdpnftxkhxndhamar
```

Ao mudar o arquivo da função, implante de novo (pelo editor ou pelo comando). A função só aceita chamadas do site publicado
(`https://cleidsonsg.github.io`) e de `http://localhost:3000`; o link do e-mail volta para `/controle-colaboradores/` (ou para a raiz, no teste local).
O texto do e-mail fica em **Authentication > Emails > Invite user**.

## 4. Cadastro e e-mails

- **Authentication > Sign In / Providers**: deixe **Allow new users to sign up** **ligado** (é o que permite a tela Solicitar acesso).
- **Authentication > Sign In / Providers > Email**: ligue **Confirm email** (obrigatório). Para conferir, abra
  `https://<seu-projeto>.supabase.co/auth/v1/settings?apikey=<chave anon>` e veja `"mailer_autoconfirm": false`.
  - O banco só aplica um convite a contas **criadas pelo convite** e **depois que a pessoa abre o link** do e-mail. Sem Confirm email,
    qualquer pessoa poderia criar contas com e-mails de terceiros para enganar quem aprova.
  - Usuário criado no painel (com ou sem **Auto Confirm User**) não usa convite: fica pendente (exceto na primeira execução do script,
    passo 2) e é aprovado em **Gestão de usuários**.
- **Authentication > URL Configuration**:
  - **Site URL**: o endereço do site publicado (ex.: `https://cleidsonsg.github.io/controle-colaboradores/`).
  - **Redirect URLs**: adicione o endereço do site publicado com `**` no fim e também `http://localhost:3000/**` para os testes no computador.
    Sem isso, os links de confirmação de e-mail e de nova senha não voltam para o sistema.
- O e-mail padrão do Supabase tem limite baixo de envios por hora. Para muitos pedidos, configure um SMTP próprio em
  **Authentication > Emails > SMTP Settings**.

## 5. Testar no computador

1. Copie `.env.example` para `.env.local` e preencha com **Project Settings > API**: Project URL e a chave `anon` `public`.
   Nunca use a chave `service_role`.
2. `npm install` e `npm run dev`, e abra o endereço mostrado no terminal.
3. Entre com o seu usuário e importe os arquivos (os dados antigos do navegador não são copiados).
4. Para testar o pedido de acesso, use outro navegador (ou janela anônima), clique em **Solicitar acesso** e aprove em **Configurações**.
5. Para testar o convite (com a função implantada, passo 3), use **Convidar usuário** com um e-mail seu, abra o link do e-mail no mesmo
   computador, crie a senha e confira que a conta entra aprovada.
6. Usuários com perfil **Usuário** só consultam: importar arquivos, limpar dados e alterar o teto exigem **Administrador**.

## 6. Site publicado (GitHub Pages)

O workflow já lê as variáveis do repositório: **Settings > Secrets and variables > Actions > Variables**,
`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Com elas preenchidas, o site publicado passa a exigir login.

## Voltar ao ponto anterior

O estado antes do Supabase está na branch `ponto-antes-supabase`.
