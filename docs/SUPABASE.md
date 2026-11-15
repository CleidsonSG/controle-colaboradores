# Supabase: configuração e teste local

Com as variáveis do Supabase definidas, o sistema exige login e grava os dados importados e o teto da folha no Supabase.
Sem elas, tudo continua funcionando só no navegador (IndexedDB), sem login.

## 1. Criar as tabelas (uma vez)

1. No painel do Supabase, abra **SQL Editor > New query**.
2. Cole o conteúdo de [`supabase/schema.sql`](../supabase/schema.sql) e clique em **Run**.

Isso cria as tabelas `datasets` (arquivos importados) e `configuracoes` (teto da folha), com RLS ligado:
só usuários autenticados leem e gravam; visitantes sem login não acessam nada.

## 2. Usuários

- Em **Authentication > Users > Add user**, crie os usuários (e-mail e senha).
- Em **Authentication > Sign In / Providers**, **desative "Allow new users to sign up"**. A chave anon fica no site
  publicado; sem essa trava, qualquer pessoa poderia criar uma conta e ver os dados.

## 3. Testar no computador

1. Copie `.env.example` para `.env.local` e preencha com **Project Settings > API**: Project URL e a chave `anon` `public`.
   Nunca use a chave `service_role`.
2. `npm install` e `npm run dev`, e abra o endereço mostrado no terminal.
3. Entre com um usuário criado no passo 2 e importe os arquivos de novo (os dados antigos do navegador não são copiados).

## 4. Site publicado (GitHub Pages)

O workflow já lê as variáveis do repositório: **Settings > Secrets and variables > Actions > Variables**,
`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Com elas preenchidas, o site publicado passa a exigir login.

## Voltar ao ponto anterior

O estado antes desta mudança está na branch `ponto-antes-supabase`.
