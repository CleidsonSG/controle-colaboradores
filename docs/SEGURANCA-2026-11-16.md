# Revisão de segurança — 2026-11-16

Escopo: versão com login Supabase (branch `feat/frontend-design-skill`, HEAD `3a8940b`) antes da 1ª publicação no GitHub Pages (repositório público). Revisão defensiva, sem alteração de código.

**Veredito: BLOQUEADO** (1 achado alto). Corrigir A1 e repetir a sonda de `auth/v1/settings`.

## O que foi verificado

| Item | Resultado |
|---|---|
| Sonda anon (sem login) `GET /rest/v1/{datasets,configuracoes,perfis,convites}` | 4x `401 / 42501 permission denied` (nenhuma linha) |
| Sonda anon `POST /rest/v1/rpc/is_admin`, `is_aprovado` | `401 / 42501` (EXECUTE revogado de anon) |
| Funções de gatilho via RPC (`touch_updated`, `criar_perfil_novo_usuario`, `proteger_perfil`) | `PGRST202` (não expostas: retornam `trigger`) |
| OpenAPI `/rest/v1/` com anon | `401` (só service_role) |
| `GET /auth/v1/settings` | **`mailer_autoconfirm: true`** (Confirm email DESLIGADO), `disable_signup: false` — ver A1 |
| Bundle `out/` | só JWT com `"role":"anon"`; `sb_secret_`/`service_role` aparecem apenas como literal da biblioteca supabase-js |
| Arquivos versionados (85) e histórico (27 commits) | nenhum segredo/JWT; nenhum CPF/CNPJ; e-mails só de exemplo; `amostras/` nunca versionada; único `.env*` = `.env.example` (placeholders) |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| `security_scan.py` | 4 "critical" + 1 "high" = **falsos positivos** (`RegExp.exec` em `lib/import/*.ts`; script de tema estático em `app/layout.tsx:31`) |
| XSS | sem `innerHTML`/`eval`; `nome` (vindo de `user_metadata`, até 120 caracteres) é renderizado por React (escapado) |
| Workflow Pages | permissões mínimas (`contents: read`, `pages`, `id-token`); vars públicas via `vars.*`; Dependabot configurado |
| Guarda de rota (`components/auth-gate.tsx:471-503`) | fail-closed: erro ou perfil ≠ `aprovado` → tela de situação, sem dados |
| Escalonamento pelo próprio usuário | bloqueado: sem INSERT/DELETE em `perfis`; UPDATE só colunas `status,papel`, só admin (RLS) e nunca a própria linha (`proteger_perfil`); `convites` só admin |

## Achados

### A1 — ALTO (bloqueia) — Convite aproveitável por terceiros com "Confirm email" desligado
- **Onde:** `supabase/schema.sql:96-123` (`criar_perfil_novo_usuario`) + configuração do Auth do projeto (`mailer_autoconfirm: true`). O próprio comentário em `schema.sql:84-85` declara que o mecanismo exige Confirm email ligado.
- **Ataque:** qualquer pessoa com a URL e a chave anon (públicas após a publicação) chama `signUp` com o e-mail de um convite ainda não usado e uma senha própria. O gatilho cria o perfil `aprovado` (com papel `admin` se o convite for de admin) e, sem confirmação de e-mail, a pessoa já entra. Resultado: leitura/alteração/exclusão dos dados de servidores (nomes, matrículas, lotação, remuneração) e, com convite admin, controle de usuários.
- **Agravante (mesma causa):** sem confirmação, qualquer um cadastra um e-mail alheio; o pedido aparece na fila de aprovação com aquele e-mail e o admin pode aprovar confiando nele (falsidade de identidade).
- **Correção:**
  1. Painel Supabase → Authentication → Sign In / Providers → Email → ligar **Confirm email** (`criadorBD`). Verificar: `GET /auth/v1/settings` → `mailer_autoconfirm: false`.
  2. Defesa em profundidade (`database-architect`): aplicar o convite só quando o e-mail estiver confirmado — no INSERT, aprovar apenas se `new.email_confirmed_at is not null`; e um gatilho `after update of email_confirmed_at on auth.users` (quando passa de null para preenchido) que consome o convite e aprova o perfil. Assim, mesmo com a opção desligada por engano, convite não vira acesso sem posse do e-mail.
  3. Opcional: enquanto não houver convites pendentes, nada a fazer; verificar no SQL Editor `select count(*) from public.convites where usado_em is null` e, se houver convite admin pendente antes da correção, cancelar e recriar depois.

### A2 — MÉDIO — Qualquer usuário aprovado pode sobrescrever ou apagar todos os dados
- **Onde:** `supabase/schema.sql:178-179` e `187-188` (`for all ... using (public.is_aprovado())`).
- **Risco:** uma conta aprovada comprometida (ou um erro) apaga ou adultera os três conjuntos e o teto; não há histórico nem backup (plano Free sem PITR).
- **Correção:** restringir `insert/update/delete` de `datasets`/`configuracoes` a `is_admin()` (se o negócio permitir) ou manter cópia anterior (tabela de histórico via gatilho) e exportação periódica fora do repositório.

### A3 — MÉDIO — Pré-cadastro de e-mail convidado (resíduo após A1)
- Mesmo com Confirm email ligado, um atacante pode se cadastrar primeiro com o e-mail convidado; a vítima recebe o e-mail de confirmação desse cadastro e, ao clicar, confirma uma conta cuja senha foi escolhida pelo atacante. A correção A1.2 não elimina esse cenário.
- **Correção recomendada:** convite enviado pelo próprio Supabase (`auth.admin.inviteUserByEmail` em Edge Function que valida `is_admin()` do chamador) — a pessoa define a senha pelo link; ou orientar o convidado a usar "Esqueci a senha" no primeiro acesso (redefine a senha e invalida a do atacante). Registrar como pendência.

### A4 — BAIXO
- `search_path = public` em vez de `''` nas funções `security definer` (`schema.sql:69, 74, 97, 142`); objetos já qualificados, risco baixo. Trocar para `set search_path = ''`.
- `touch_updated` (`schema.sql:26-32`) sem `search_path` fixo (alerta `function_search_path_mutable` do Security Advisor).
- Políticas usam `auth.uid()`/`is_*()` sem `(select ...)` (`schema.sql:166, 169, 177-188`): desempenho (initPlan).
- `datasets.records` sem limite de tamanho: um aprovado pode gravar JSON enorme (cota). Considerar `check (pg_column_size(records) < N)`.
- `perfis.email` não acompanha troca de e-mail no Auth (`proteger_perfil` fixa o valor antigo); o admin pode ver e-mail desatualizado.
- Cadastro público aberto sem CAPTCHA: spam de perfis pendentes e de e-mails de Auth. Considerar Turnstile/hCaptcha do Supabase Auth e SMTP próprio (o padrão tem limite baixo).
- Mensagens de erro de login exibem o texto bruto do Supabase e citam `.env.local` (`components/auth-gate.tsx:70-76`): vazamento de informação mínimo; em produção, mensagem genérica.
- Binário `pglast-...whl` (8 MB, pacote público) versionado na raiz desde `34c974e`, já presente na branch remota: higiene de supply chain; remover do índice e ignorar `*.whl` antes do merge em `main`.
- Sem CSP (`<meta http-equiv="Content-Security-Policy">`): recomendável; headers HTTP não são configuráveis no Pages.

## LGPD (observações)
- Dados de servidores (incluindo remuneração) ficam só no Supabase, protegidos por RLS; nada no repositório.
- Falta aviso de privacidade (finalidade, base legal, operador Supabase, contato) e definição de retenção — encaminhar ao `product-owner`.
- Confirmar região do projeto Supabase (`sa-east-1` recomendada).

## Reteste de A1 (2026-11-16, commit `a5ae4f9`) — RESOLVIDO

Veredito do reteste: **APROVADO** (A1 fechado; A2/A3/baixos continuam como pendências não bloqueantes).

| Verificação | Resultado |
|---|---|
| `GET /auth/v1/settings` (anon) | `mailer_autoconfirm: false` (Confirm email ligado) |
| `POST /rest/v1/rpc/aplicar_convite` com `Content-Profile: private` | `406 PGRST106` (só `public` e `graphql_public` expostos) |
| Sonda anon nas 4 tabelas e RPC `is_*` (orquestrador) | 401/42501 |
| Revisão do diff de `supabase/schema.sql` | ver abaixo |

- O perfil nasce sempre `pendente`/`usuario`. O convite só é aplicado com `email_confirmed_at` **e** `confirmation_sent_at` preenchidos. Assim, a autoconfirmação (que não envia link) não consome convite mesmo que a opção seja desligada de novo.
- O gatilho `ao_confirmar_email` só dispara na transição `null → preenchido` de `email_confirmed_at`. O usuário não grava em `auth.users` (o schema `auth` não está exposto), e a troca de e-mail de uma conta já confirmada não passa por essa transição. Logo, não dá para contornar trocando o e-mail para um convidado.
- `private.aplicar_convite`: schema sem `usage` para `public/anon/authenticated`, EXECUTE revogado, `search_path = ''` e nomes qualificados. Só altera perfis `pendente` e é idempotente (`for update` no convite).
- As funções de gatilho em `public` retornam `trigger` e não podem ser chamadas como RPC.
- Bootstrap (`insert ... from auth.users ... 'aprovado' on conflict do nothing`): continua aprovando só usuários sem perfil, ou seja, os anteriores ao gatilho. Isso é aceitável enquanto o cadastro público e o gatilho existirem juntos. Não rode o `schema.sql` depois de desativar o gatilho.
- Os baixos de `search_path` e `(select auth.uid())` também foram resolvidos.

**Pendências deste reteste (não bloqueiam):**
1. Contas criadas enquanto a autoconfirmação estava ligada não são reavaliadas. O admin deve conferir no SQL Editor se todos os perfis `aprovado` e os convites com `usado_em` preenchido são esperados, e bloquear o que não reconhecer.
2. A3 (pré-cadastro com e-mail convidado) continua médio. Orientar o convidado a usar "Esqueci a senha" no 1º acesso, ou migrar o convite para `inviteUserByEmail` em Edge Function.
3. Usuários convidados pelo painel ("Invite user") podem ficar pendentes (sem `confirmation_sent_at`). Nesse caso, o admin aprova manualmente.

## Reteste exigido para liberar (original)
1. `GET https://<ref>.supabase.co/auth/v1/settings` (apikey anon) → `mailer_autoconfirm: false`.
2. Se A1.2 for aplicada: novo cadastro com e-mail convidado não confirmado → perfil `pendente` até a confirmação.
3. Repetir a sonda anon das 4 tabelas (deve continuar 401/42501).
