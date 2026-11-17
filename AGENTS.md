# Fluxo de trabalho do projeto

- Antes de planejar ou delegar, siga a [governança](../.agent/rules/GOVERNANCA.md), o [roteiro](../.agent/rules/roteirodeconstrucao.md) e as responsabilidades do [orquestrador](../.agent/agents/orchestrator.md).
- Publicação: site estático no GitHub Pages (`output: 'export'` no `next.config.ts`). Não use server actions, route handlers, proxy ou `next/headers`. Publique com `python ../.agent/scripts/publish_github.py . -m "<msg>" --wait` após validação verde e autorização do usuário.
- **Visual:** o agente líder `frontend-design` (1ª opção para qualquer pedido visual) e a skill `frontend-design` do workspace decidem a aparência; as especificidades deste projeto estão na skill local [`controle-visual`](./.claude/skills/controle-visual/SKILL.md) e no [guia visual](./docs/GUIA-VISUAL.md). Padrão obrigatório: Tailwind CSS + shadcn/ui; não escreva CSS à mão nem crie classes próprias. Outros agentes de frontend só entram havendo necessidade.
- Leia [PROJECT_STATE.md](./PROJECT_STATE.md) para retomar o estado atual; mantenha-o e o índice global atualizados após mudanças relevantes.
- Persistência: **Supabase com login** autorizado pelo usuário em 2026-11-15 (Supabase Auth + RLS só para usuários **aprovados**; cadastro pela tela "Solicitar acesso" cria perfil pendente e um administrador aprova em "Configurações > Gestão de usuários", onde também convida (pré-aprovação) e envia links de nova senha — autorizado em 2026-11-16; ver [docs/SUPABASE.md](docs/SUPABASE.md) e `supabase/schema.sql`). Sem as variáveis `NEXT_PUBLIC_SUPABASE_*`, o sistema usa só o navegador (IndexedDB, autorizado em 2026-11-13). Use apenas a chave `anon` no cliente; nunca a `service_role`. Não adicione outros serviços externos sem autorização. O usuário pode apagar tudo pelo botão "Limpar dados importados".
- Apuração: KPIs e contagens por cargo são calculados depois da importação (`lib/folha/apuracao.ts`): só servidores comissionados ativos (marca 282/16) contados pela coluna "Descrição do cargo" (função) do e-Cidade; os demais ativos viram aviso. Fontes por tela: e-Cidade → Painel de Cargos; Cadastro funcional (xlsm) → Funcionários; Tabela salarial → aba Comissionado: Painel/Orçamento, aba Terceirizado: conferência em Funcionários; custo = salário da tabela salarial × servidores; vagas livres = saldo do teto ÷ salário do cargo.
- Ponto de retorno antes do Supabase: branch `ponto-antes-supabase`.
- Arquivos reais de exemplo ficam em `amostras/` (fora do Git) e nunca entram em fixtures, commits ou logs.
- Trate dados pessoais como sensíveis; não use dados reais em fixtures, logs ou testes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
