# Estado do projeto — Controle de Colaboradores

**Atualizado em:** 2026-11-19  
**Pasta:** `Controle_Colaboradores`  
**Plano:** [controle-colaboradores.md](./controle-colaboradores.md)

## 2026-11-17 (noite): indicadores + relatório de indicações (branch `feat/indicadores-indicacoes`, commit `de9f378`; PUBLICADO em 2026-11-17 como `253d46d`, deployment success, HTTP 200; schema.sql e função convidar-usuario aplicados pelo usuário e conferidos por sonda anon)
- KPIs aprovados pelo usuário: ocupação/custo por lotação e movimentação mensal (Painel), custo com alimentação (Funcionários). Nova tela `/indicacoes` (só admin): filtros, resumo, detalhe, Excel/PDF. Indicação saiu da tabela/CSV de Funcionários e foi para a tabela `public.indicacoes` (RLS só admin) — **exige rodar `supabase/schema.sql` ANTES de publicar** (revisão de segurança: aprovado com condição).
- Normalização do Cadastro genérico (só COM, só TER, abas vazias; grafia original preservada; .xls recusado com orientação). Bug ROÇADOR (repetição vazia anulava o valor) corrigido. 108/108 testes com arquivos reais.
- Proposta de ajuste de remuneração dos terceirizados em `docs/PROPOSTA-REMUNERACAO-TERCEIRIZADOS.md` (opção a: tabela da Prefeitura prevalece) — aguarda aprovação do usuário. A tabela atualizada está em Desktop/TEMP, não em ARQUIVOS DE EXEMPLO.
- Usuário: não é preciso comunicar a ANPD (decisão de 2026-11-17).

## 2026-11-17 (tarde): planilhas por tela + INCIDENTE LGPD — LEIA PRIMEIRO
- **Incidente:** `ARQUIVOS DE EXEMPLO/GERAL ECIDADE.csv` (relatório DEMITIDOS, 3.420 nomes) e `TABELA SALARIAL.xlsx` foram enviados ao repositório público em `e852c9c` (publicado como `9e950e0`). Histórico local reescrito (main limpa, `.gitignore` cobre a pasta e *.xlsx/*.xlsm). Force push feito pelo usuário (main = `d96072c`, sem planilhas; deployment success, HTTP 200 — entrega das planilhas por tela PUBLICADA). **Pendente:** pedir ao suporte do GitHub a remoção do cache do commit antigo. `publish_github.py` agora bloqueia planilhas em commits não enviados.
- CSV ADMITIDOS (971) recolocado pelo usuário; com os 3 arquivos reais: 87/87 testes; Painel 753 comissionados ativos, 85 desligados, 116 fora da contagem, 21 funções todas com salário, custo R$ 3.354.941,62; Funcionários 12+22, custo mensal total R$ 138.905,95.
- Commit local `99f4797`: e-Cidade → só Painel (só 282/16 ativos; aviso de relatório DEMITIDOS); Cadastro funcional → só Funcionários (abas por nome, subtotais COM/TER/Total, custo mensal, conferência com tabela Terceirizado); tabela salarial com avisos. Análise: `docs/ANALISE-ARQUIVOS-2026-11-17.md`. 
- KPIs propostos pelo idealizador (aguardam escolha): 1 lotação, 2 movimentação mensal, 3 custo com alimentação (recomendados); Indicação = dado sensível, só agregado para admin e com finalidade confirmada.

## 2026-11-17: segurança A2/A3 + LGPD (branch `fix/seguranca-lgpd`, commit `e852c9c`; PUBLICADO em 2026-11-17 como `9e950e0`, deployment success, HTTP 200)
- A2: só admin grava `datasets`/`configuracoes` (RLS); interface somente leitura para não admin. A3: convite pela Edge Function `supabase/functions/convidar-usuario` (`inviteUserByEmail`); convite só aprova conta criada por convite, com e-mail confirmado e sem senha prévia. Reteste de segurança APROVADO (seção em `docs/SEGURANCA-2026-11-16.md`).
- LGPD: rota `/privacidade` (contato do encarregado = placeholder em `lib/privacidade.ts`).
- **Antes/junto da publicação o usuário precisa:** rodar `supabase/schema.sql` de novo no SQL Editor e implantar a função `convidar-usuario` (Verify JWT ligado) — ver `docs/SUPABASE.md`.
- Teste com arquivos reais (sem login): 3.420 registros no e-Cidade, mas TODOS com data de rescisão → painel mostra 0 ativos hoje; a planilha leu 12 comissionados e 0 terceirizados; não existe arquivo de tabela salarial real (o cabeçalho com Matrícula é recusado). Decisões pendentes do usuário: uso da remuneração dos terceirizados e regra de soma da tela Funcionários.

## 2026-11-17: push de `2cffa14` (só docs), deployment success, smoke HTTP 200. Usuário confirmou Site URL/Redirect URLs e conferência de perfis/convites: feitos e funcionais.

## Publicado em 2026-11-16 (`d599b18`) — LEIA PRIMEIRO

Branch `feat/frontend-design-skill` juntada à `main` (`193c2b2`) e publicada: visual Tailwind/shadcn, painel de cargos, orçamento, Supabase com login e aprovação, gestão de usuários, tabela salarial com abas Comissionado/Terceirizado, 1ª importação exige os 3 arquivos (depois, individual). Deployment `success`, smoke HTTP 200, bundle usa o projeto `epvrdpnftxkhxndhamar`. Variáveis `NEXT_PUBLIC_SUPABASE_*` cadastradas no GitHub (vars).
Segurança: `docs/SEGURANCA-2026-11-16.md` — A1 (convite sem e-mail confirmado) corrigido em `a5ae4f9` e reteste APROVADO; Confirm email ligado (`mailer_autoconfirm:false`). Abertos (não bloqueiam): A2 (qualquer aprovado sobrescreve datasets), A3 (pré-cadastro do e-mail convidado), baixos (`.whl` de 8 MB versionado, CSP, CAPTCHA), LGPD (aviso de privacidade/retenção).
Pendências do usuário: decidir uso da remuneração de terceirizados.

## Retomada no computador local (2026-11-16, histórico)

Todo o trabalho desta etapa está na branch `feat/frontend-design-skill` (não publicada; `main` intacta). Ponto de retorno: branch `ponto-antes-supabase`.

**Supabase real conectado (2026-11-16, fim do dia):** projeto `epvrdpnftxkhxndhamar` (o `.env.local` chegou a misturar URL e chave de projetos diferentes; corrigido pelo usuário). Tabelas e RLS já existem nele (anon recebe 42501). Login do dono funcionou; entrou como pendente e foi orientado a se promover a admin pelo SQL Editor. Itens 1 e 2 abaixo: na prática resolvidos; confirmar admin na próxima sessão.

**Tabela salarial com duas abas (2026-11-16, commit local, não publicado):** `lib/import/tabela-salarial.ts` lê todas as abas com Função/Remuneração (ou Cargo/Salário); a origem vem do nome da aba (Comissionado/Terceirizado; senão, 1ª/2ª posição) e fica em `CargoSalario.origem`. A apuração do e-Cidade (`lib/folha/apuracao.ts`) ignora a aba Terceirizado (a mesma função tem valores diferentes nas duas abas). **Pendente:** decidir onde a remuneração dos terceirizados deve ser usada (hoje só é guardada) e o usuário reimportar a tabela salarial.

**Diagnóstico de 2026-11-16 (causa encontrada):** o `.env.local` deste computador é cópia idêntica do `.env.example` (mesmo tamanho e horário): URL `https://SEU-PROJETO.supabase.co` e chave `sua-chave...`. Esse endereço não existe (DNS responde "nome não existe"), por isso dá "Failed to fetch". A rede está normal: sem proxy, arquivo hosts limpo, `supabase.co` responde HTTP 200 por HTTPS. Correção: preencher o `.env.local` com a Project URL e a chave `anon` reais e reiniciar o `npm run dev`.

**Bloqueio anterior (hipótese descartada):** no computador do usuário, o login falha com "Failed to fetch". O `.env.local` está correto (um celular acessa o projeto Supabase normalmente), mas o navegador do computador não abre `https://<projeto>.supabase.co/auth/v1/health` ("Não é possível acessar esse site"). Causa provável: rede corporativa (IP 10.19.x.x) ou DNS/proxy/antivírus da máquina. Diagnosticar com `nslookup` (DNS padrão e 1.1.1.1), `Test-NetConnection -Port 443`, `netsh winhttp show proxy`, arquivo hosts e `ipconfig /flushdns`; testar também com o computador no roteador do celular. Propor a correção ao usuário antes de alterar configurações. Enquanto isso, renomear `.env.local` faz o sistema rodar sem login (IndexedDB).

**Ainda não verificado contra o Supabase real** (só em PostgreSQL local simulado e com respostas simuladas):
1. Se `supabase/schema.sql` (versão atual, com `perfis` e `convites`) foi executado no SQL Editor.
2. Se o usuário do dono existe em Authentication > Users e virou administrador (ver `docs/SUPABASE.md`).
3. Supabase Auth: "Allow new users to sign up" e "Confirm email" ligados; Redirect URLs com o site publicado (`https://cleidsonsg.github.io/controle-colaboradores/**`) e `http://localhost:3000/**`.
4. Fluxo completo: entrar, importar os 3 arquivos (e-Cidade, planilha, tabela salarial), salvar o teto, conferir painel e orçamento, pedido de acesso/aprovação, convite e nova senha.

**Depois da aprovação do usuário:** conferir as variáveis `NEXT_PUBLIC_SUPABASE_*` em Settings > Secrets and variables > Actions do GitHub, juntar a branch à `main` e publicar (só com autorização).

**Pendências de produto:** regra de soma da tela 2 (planilha de terceirizados), a definir pelo usuário; teste com as amostras reais (ficam só em `amostras/`); trabalho local guardado em `git stash` ("backup-analytics") e na branch local `backup-local-main`, que o usuário decidiu não usar; possível conflito entre a skill `frontend-design` do projeto e a `professional-ui` do repositório equipe-agentes.

## Configurações > Gestão de usuários (2026-11-16, branch `feat/frontend-design-skill`)

Pedido do usuário com captura de referência (tela "Configurações" com abas Usuários / Convites pendentes / Reset de senha).
- Rota `/settings` (`components/gestao-usuarios.tsx`) substitui `/users`. Abas: **Usuários** (tabela no desktop, lista no celular; busca, filtro por situação, perfil Usuário/Administrador por seletor com confirmação, Aprovar/Recusar/Bloquear/Desbloquear), **Convites pendentes** (copiar link de cadastro, cancelar), **Reset de senha** (envia link do Supabase). Botão **Convidar usuário**.
- Colunas Cargo e Departamento da referência ficaram de fora: não há esses dados (o usuário pediu só nome e e-mail).
- Abas Segurança/Geral/Notificações da referência não foram criadas (sem conteúdo definido).
- **Convites** = pré-aprovação (tabela `convites`, só admin; gatilho de novo usuário aprova com o papel do convite e marca como usado). O sistema não envia e-mail de convite (exigiria chave service_role/servidor); o admin copia o link `/?cadastro=1`. Depende de "Confirm email" ligado.
- **Senha:** "Esqueci minha senha" na tela Entrar e tela "Criar senha nova" ao voltar pelo link (evento PASSWORD_RECOVERY).
- Validação: 8 cenários extras de SQL no PostgreSQL local (inclui atualização a partir da versão anterior do script), 68/68 testes, capturas com Supabase simulado.

## Acesso por solicitação e aprovação (2026-11-16, branch `feat/frontend-design-skill`)

Pedido do usuário: novos acessos solicitados pela tela de cadastro, sem campos extras além de nome e e-mail.
- **Banco** (`supabase/schema.sql`, idempotente): tabela `perfis` (status pendente/aprovado/bloqueado, papel admin/usuario), gatilho cria perfil pendente a cada novo usuário do Auth, funções `is_aprovado()`/`is_admin()`; `datasets` e `configuracoes` exigem perfil aprovado; só admin altera perfis, nunca o próprio (gatilho), e só as colunas status/papel. Usuários existentes ao rodar o script ficam aprovados; o mais antigo vira admin se não houver nenhum.
- **Telas** (`components/auth-gate.tsx`; a tela de usuários foi depois movida para `/settings`): Entrar, Solicitar acesso (nome, e-mail, senha ≥ 8, confirmação por e-mail), Aguardando aprovação, Acesso bloqueado, Usuários (só admin: aprovar, bloquear, desbloquear, tornar/remover admin, com confirmação nas ações sensíveis). Item "Usuários" no menu só para admin.
- **Validação:** 15 cenários de RLS testados num PostgreSQL 16 local com `auth.users`/`auth.uid()` simulados (pendente sem acesso, comum não aprova, admin não altera a si mesmo, bloqueado perde acesso, anon sem acesso); 67/67 testes; capturas com respostas do Supabase simuladas. Não testado contra um Supabase real.
- **Configuração no Supabase** mudou: cadastro público fica LIGADO (a segurança agora é a aprovação), Confirm email ligado, Site URL e Redirect URLs (ver `docs/SUPABASE.md`).

## Painel de cargos + tabela salarial + Supabase (2026-11-15, branch `feat/frontend-design-skill`, não publicada)

Ponto de retorno: branch `ponto-antes-supabase` (commit `fcd6212`), pedido do usuário caso não aprove o resultado.
- **Rotas:** `/` = Painel de cargos (tela principal); `/import` = Importar; `/budget` = Orçamento; `/employees` = Funcionários (tela 2, sem mudança de regra: a soma da planilha de terceirizados será definida depois pelo usuário).
- **Tabela salarial:** 3º tipo de importação (`salarial`, .csv/.xlsx/.xlsm, colunas Cargo e Salário; aliases em `lib/import/tabela-salarial.ts`). Reconhecida pelo cabeçalho (cargo + salário, sem matrícula); o cartão "Tabela salarial" força o tipo. Cargo repetido: vale o primeiro (aviso).
- **Apuração** (`lib/folha/apuracao.ts`): conta servidores ativos (sem rescisão ou rescisão futura) por "Descrição do cargo", sem diferenciar caixa/acentos; cruza com a tabela salarial; custo = salário × servidores; saldo = teto − custo; vagas livres por cargo = ⌊saldo ÷ salário⌋ (mesmo saldo para todos). Cargos fora da tabela ficam sem custo e são listados em alerta; cargos da tabela sem servidores aparecem com 0.
- **Teto da folha:** informado no painel e gravado em `Settings.tetoFolha` (centavos).
- **Orçamento:** usa os dados apurados quando há e-Cidade, tabela salarial e teto; senão, valores fictícios com o motivo.
- **Supabase com login** (autorizado em 2026-11-15): `lib/supabase/client.ts`, `lib/storage/supabase-store.ts`, `components/auth-gate.tsx`, `supabase/schema.sql`, `docs/SUPABASE.md`. Sem variáveis, usa IndexedDB (v2: stores `tabelaSalarial` e `configuracoes`).
Validação: lint, typecheck, 64/64 testes (+11), build com e sem variáveis do Supabase; capturas do painel (claro/desktop, escuro/celular), orçamento e login com dados fictícios. **Não testado contra um Supabase real** (feito pelo usuário localmente).

## Orçamento da folha — simulação de vagas (2026-11-15, branch `feat/frontend-design-skill`)

Rota `/budget` (antes "em preparação"): teto mensal editável, faixa da folha por cargo (AS 1 a AS 6), saldo, cartões por cargo (salário, ocupadas/vagas, livres, custo, botões + e −) e simulador de troca ("reduzir N vagas do cargo A para abrir vagas do cargo B", com aviso de exonerações). Regra: + só com saldo; − não reduz abaixo das ocupadas. Lógica pura em `lib/folha/simulacao.ts` (centavos), 8 testes em `tests/folha-simulacao.test.mjs`.
**Valores fictícios** (`FOLHA_SIMULADA`: teto R$ 100.000; AS 1 R$ 8.500 … AS 6 R$ 2.600) até o usuário informar os reais; estado só em memória (sem gravação, nenhuma nova persistência autorizada).
Pendências: valores reais; decidir se as ocupadas vêm da planilha importada (coluna Função) e se a configuração deve ser gravada no navegador (exige autorização).

## Migração visual para Tailwind + shadcn/ui (2026-11-15, branch `feat/frontend-design-skill`, não publicada)

Skill `frontend-design` (`.claude/skills/frontend-design/`) é a autoridade visual; regras em `AGENTS.md` e tokens em `docs/GUIA-VISUAL.md`. CSS manual (427 linhas) substituído por Tailwind v4 + componentes no padrão shadcn/ui em `components/ui/` (Radix via `radix-ui`, ícones `lucide-react`); `globals.css` só com tokens de tema claro/escuro. Fonte Public Sans empacotada. Telas migradas: menu lateral, Importar, Funcionários, tabela e páginas em preparação. Lógica, textos de privacidade e acessibilidade preservados (foco visível, skip link, `aria-*`, `prefers-reduced-motion`); diálogos agora usam Radix Dialog.
Validação: lint OK, typecheck OK, 45/47 testes (2 skip = amostras reais), build com BASE_PATH OK; conferência por captura de tela em claro/escuro, 1280px e 375px, com dados fictícios.
Pendências: teste manual com as amostras reais; revisão de acessibilidade com leitor de tela; tela de cards por função (vagas ocupadas/livres).

## Importação v2 + redesign — **publicado em 2026-11-13** (`d6e7932`, deployment success, smoke HTTP 200)

Diretriz e decisões do usuário: [docs/DIRETRIZ-IMPORTACAO-V2.md](docs/DIRETRIZ-IMPORTACAO-V2.md). CSV e-Cidade (windows-1252, cabeçalho na linha 5) e planilha XLSX/XLSM (só as 2 primeiras abas, fusão com Origem); "Tipo de carga" e "Associe os campos" removidos; passos Arquivo → Prévia → Confirmação; persistência em IndexedDB (autorizada) com "Limpar dados importados"; nova rota `app/employees` com 2 abas (busca, ordenação, filtros, paginação de 50, exportar CSV, somas). `lib/import-data.ts` e as regras antigas (CPF, cargo/quantidade/ano/mês) foram removidos; `tsconfig` com `allowImportingTsExtensions` (autorizado).
Validação: lint OK, typecheck OK, 43/45 testes (2 skip = amostras reais ausentes em `amostras/`), build com BASE_PATH OK, prévia gerada.
Pendências: validar com `amostras/GERAL_ECIDADE.csv` (esperado 3.421) e `amostras/CADASTRO_FUNCIONAL.xlsm` (medir tempo de leitura com a aba DADOS); teste manual no navegador (arrastar, persistência após recarregar).

Redesign aprovado pelo usuário (H10, 2026-11-13): tela Importar com dois cartões (CSV e planilha, soltar os dois de uma vez, só resumo, nenhum dado de pessoa), botão único "Importar arquivos"; temas Claro/Escuro/Sistema (localStorage `cc-theme`, script inline anti-flash); Funcionários com 4 indicadores. Rodapé "TOTAL" do CSV reconhecido: o arquivo real tem 3.420 funcionários e o rodapé do e-Cidade declara 3419 (aviso). Testes 47/47 com as amostras reais (`ECIDADE_CSV`/`PLANILHA_XLSM`; a planilha real está em `Documents/CLEIDSON/[CONTINUAR]/`, em `amostras/` há só um atalho).

## Situação (histórico)

Protótipo local em Next.js App Router, React e TypeScript. A navegação dos oito módulos está disponível; as áreas ainda não implementadas são identificadas como preparação. O fluxo funcional é a importação local de CSV, XLSX e XLSM, com seleção de aba, mapeamento, validação e prévia. Nenhum dado é gravado ou enviado.

## Verificação

- `npm test`: 8 testes aprovados cobrindo CSV/XLSX/XLSM, fórmulas, validação, mapeamento e limites.
- `npm run lint`, `npm run typecheck` e `npm run build`: aprovados.
- Smoke test de produção no navegador: `/` e `/dashboard` carregaram corretamente; a rota Dashboard não apresenta métricas fictícias.
- Fluxo de importação testado pela interface com CSV sintético: contagem de linhas válidas/inválidas, mensagem de erro de mês, CPF oculto por padrão e limpeza completa do estado/arquivo aprovados.
- Busca no código de `app/`, `components/` e `lib/` não encontrou chamadas de rede, armazenamento local nem logs de console.
- Suíte executada com Node.js v24.17.0; o Node emite um aviso de detecção de módulo ao importar o parser TypeScript diretamente, sem falha nos testes.

## Publicação (GitHub Pages)

- 2026-11-12: o projeto ficou compatível com export estático (`output: 'export'`, `basePath` via `BASE_PATH`, `trailingSlash`, `generateStaticParams` + `dynamicParams = false` em `app/[section]`). Validação: lint OK, typecheck OK, 8/8 testes, build com `BASE_PATH=/controle-colaboradores` gerando as 8 páginas com assets no subcaminho.
- **Publicado em 2026-11-12** (autorizado pelo usuário): commit `e369a43` em https://github.com/CleidsonSG/controle-colaboradores; workflow "Deploy GitHub Pages" concluído com sucesso; site em https://cleidsonsg.github.io/controle-colaboradores/. O smoke HTTP não é verificável desta máquina, que bloqueia `*.github.io`.
- **Publicado em 2026-11-13** (autorizado pelo usuário após a prévia): commit `a4a4187`; deployment `success`; smoke HTTP 200 na home, em `/dashboard/` e em um asset. Conteúdo desta entrega:
  - Acessibilidade WCAG 2.2 AA conforme [docs/acessibilidade-auditoria.md](docs/acessibilidade-auditoria.md): C1, C2, A1–A6, M1–M8, B1, B3–B9 aplicados; B2 não aplicado.
  - Regras de negócio aprovadas em 2026-11-12: CPF opcional, mas validado (DV, zeros à esquerda); matrícula duplicada no mesmo mês/ano é erro; mês só numérico; `lib/export-data.ts` (exportação XLSX/CSV de válidos e erros).
  - Testes: 89/89 (`tests/import-rules.test.mjs`, `tests/export-data.test.mjs`, `tests/helpers.mjs`); script de teste com glob.
  - Validação: lint, typecheck, 89/89 testes e build (com e sem BASE_PATH) verdes; prévia gerada em `.preview/`.
- Próxima entrega: nova prévia, validação verde e pergunta H9; depois `python ../.agent/scripts/publish_github.py . -m "<msg>" --wait`.

## Limites e pendências

- Campos obrigatórios, duplicidades, atualização/mesclagem e comportamento após a prévia ainda não foram aprovados como regras de negócio.
- Não há backend, banco, autenticação nem retenção. A publicação no GitHub Pages está pronta, mas aguarda autorização.
- XLSM é lido como planilha; macros não são executadas. CSV é aceito em UTF-8.

## Pendências ao retomar (projeto pausado pelo usuário em 2026-11-12)

1. `frontend-specialist`: botões "Baixar válidos" (XLSX) / "Baixar erros" na tela de prévia, usando `buildExport` de `lib/export-data.ts` (desabilitar quando a contagem for 0; tratar `ExportFileError`). Opcional: exibir `row.normalized` (CPF formatado) na prévia.
2. `frontend-expert-specialist`: revisar o diff de acessibilidade contra os 13 critérios; os critérios 2, 3, 4, 7, 10 e 11 exigem teste em navegador (`qa-automation-engineer`).
3. Título da página 404 (`app/not-found.tsx`).
4. Prévia → pergunta de publicação.

## Próximo passo

Fazer uma revisão detalhada de acessibilidade e confirmar regras de negócio antes de ampliar a importação para persistência ou desenvolver módulos operacionais.

## DESIGN.md do Impeccable (2026-11-18)

`/impeccable document` (modo Scan) gerou `DESIGN.md` na raiz e `.impeccable/design.json` (sidecar, 8 componentes) a partir do visual aprovado. Estrela-guia: "Repartição Bem Cuidada"; componentes discretos e precisos; cores Azul-Petróleo Institucional (#0b5c74), Ardósia Noturna (#0e2a33), Papel Frio (#f4f6f8); temas claro/escuro. `DESIGN.md` está **congelado** (GOVERNANCA §4): telas novas seguem esse arquivo e mudanças de aparência só a pedido do usuário. `docs/GUIA-VISUAL.md` fica como histórico. Só documentação, sem mudança de código nem publicação.

## Conciliação de remuneração (2026-11-18, branch `feat/conciliacao-remuneracao`, commit `0dc8f80`, NÃO publicada)

Decisão do usuário: opção (c), **a planilha da empresa prevalece**. Custo, KPIs e subtotais continuam pelo valor informado; a tabela salarial da Prefeitura (abas Comissionado e Terceirizado) é só conferência (`lib/folha/conciliacao.ts`, feita na importação e na leitura). Função sem valor na tabela usa o informado, com selo. Em Funcionários: colunas Remuneração (tabela), Diferença e Situação (Confere/Diverge/Sem valor na tabela/Fora da tabela/Não informada), filtro Situação, painel "Conferência de remuneração" (COM+TER) com CSV `divergencias-remuneracao.csv` sem nomes, KPI informativo "Diferença informado x tabela". Correção: função repetida na tabela → primeiro valor não vazio vence (ROCADOR/ROÇADOR), com `chaveFuncao` única em tabela-salarial, apuracao e indicadores. Validação: lint ok, typecheck ok, 115 testes (111 pass, 0 fail, 4 skipped), build ok. Capturas com dados sintéticos em `.preview/conciliacao/` (build local sem Supabase): sem rolagem horizontal da página.
Pendências: publicação recusada nesta entrega (perguntar de novo na próxima); no celular, valores e selo do painel só aparecem rolando a tabela; aviso "Duplicidades" da tabela não nomeia a função; contagem com dados reais (esperado 22 conferem, 5 divergem) não verificada; gravação da planilha reconciliada no Supabase não exercitada em ambiente real; causa dos +R$ 489,32 do AUXILIAR DE FARMÁCIA (AVANT) com a Prefeitura.

## Aba Funcionários v2 + Histórico do Funcionário (2026-11-18, em andamento)

Especificação em `docs/features/aba-funcionarios.md` (product-manager; 9 ajustes do `ABA FUNCIONÁRIOS.docx` + painel "Histórico do Funcionário", R1–R16) com as decisões do usuário P1–P4 no fim. Sem dados pessoais no documento. Fatias: 1 = **concluída** (R1–R3, R8, R10, R11 + painel `components/employee-history-dialog.tsx` com o retrato atual; lógica `lib/folha/historico.ts` + `tests/historico.test.mjs`; E2E sintético aprovado: foco volta ao nome, URL intacta, sem rolagem horizontal em 390 px) ; 2 = **concluída** (R4, R5, R6 só leitura, R9: `components/conferencia-detalhe-dialog.tsx`, `components/export-buttons.tsx`, `lib/export-funcionarios.ts`, `agregarPorFuncao` em `lib/folha/conciliacao.ts`; E2E sintético aprovado) (commit local `5db5cc8` na branch `feat/funcionarios-fatia2`, NÃO publicado por decisão do usuário) → **próximo: fatia 3**; 3 = histórico por competência (tabela nova + RLS: `database-architect` → `criadorBD` → `security-auditor`); 4 = editar valor (até a próxima importação); 5 = KPIs e gráfico por empresa. Publicado junto com a conciliação em 2026-11-18 (`main` @ `e08af40`, deployment success, HTTP 200).

### Fatias 3–5 (2026-11-18, branch `feat/funcionarios-fatias-3-5`, a partir da fatia 2 não publicada)
- Fatia 5 **concluída** (`588786d`): `components/terceirizados-por-empresa.tsx`, `lib/folha/empresas.ts`, `tests/empresas.test.mjs`. A tabela por empresa agora usa todos os terceirizados (não segue os filtros da tabela).
- Desenho do banco das fatias 3/4 **concluído** (`676bcb9`): `historico_competencias`, `historico_retratos`, `ajustes_remuneracao` (só inclusão, por `imported_at`), RPC `substituir_historico_competencia`, gatilho `preparar_ajuste_remuneracao`; contrato em `docs/HISTORICO-DADOS.md`. SQL só conferido por parser (sem Postgres local). A migration isolada depende do `schema.sql` (sem migration de base).
- Fatias 3 e 4 **concluídas** (`16b31e2`): DataStore (memória, IndexedDB v3, Supabase), competência na importação, painel lendo o histórico + exportação, "Alterar valor" só admin (`lib/folha/ajustes.ts`, `tests/historico-ajustes.test.mjs`). Validação: lint/tipos limpos, testes 136/132/0 (4 pulados), build OK.
- `security-auditor`: sem crítico/alto. Achados 1–4 corrigidos na própria migration (`56ed53e`: is_admin antes do jsonb + teto de 15 MB, `importado_em` ≤ now(), valor ≥ 1 centavo, 42501 no gatilho). Abertos (baixo): prazo de retenção do histórico/auditoria, concorrência entre dois admins (`pg_advisory_xact_lock`).
- E2E sintético (Playwright, IndexedDB): itens 1–5 aprovados; capturas em `.preview/fatias3-5/`. As capturas "escuro" saíram claras (tema "Sistema" no headless), então o axe no escuro não valeu.
- H9 "Sim, publicar" (2026-11-18). **Pendente com o usuário:** rodar `supabase/migrations/20261118120000_historico_competencias.sql` no SQL Editor (sem isso, o site publicado abre sem histórico e sem ajustes).

## Correções1 da aba Funcionários (2026-11-19, PUBLICADO como `10b4203`, deployment success, HTTP 200)
Fonte: `ARQUIVOS DE EXEMPLO/ABA FUNCIONÁRIOS CORREÇÕES1.docx`. Toda Situação da conferência (Ok/Diverge/Sem referência) é botão e abre o detalhe; "Confere" → "Ok"; detalhe lista todas as pessoas da função (pendentes primeiro); "Alterar valor" com alcance "Somente esta pessoa" / "Todas as N pessoas da função" (`DataStore.saveAjustes`, gravação em lote tudo-ou-nada, sem mudança de schema); menu único "Exportar" (Excel/PDF, `components/ui/dropdown-menu.tsx`); Terceirizados por empresa com KPIs no topo e filtro alinhado ao ranking; nome acessível do ranking corrigido (WCAG 2.5.3). Validação: lint/tipos limpos, 134 pass/0 fail, build OK; E2E sintético (IndexedDB) aprovado, axe 0 violações; capturas em `.preview/correcoes1/`.
Pendências: "Sem referência" não entra em `precisaAtencao` nem no export de divergências (decisão a confirmar com o usuário); lote no Supabase não testado contra banco real; usuário ainda precisa rodar `supabase/migrations/20261118120000_historico_competencias.sql`.
