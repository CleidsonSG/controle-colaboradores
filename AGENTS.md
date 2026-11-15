# Fluxo de trabalho do projeto

- Antes de planejar ou delegar, siga a [governança](../.agent/rules/GOVERNANCA.md), o [roteiro](../.agent/rules/roteirodeconstrucao.md) e as responsabilidades do [orquestrador](../.agent/agents/orchestrator.md).
- Publicação: site estático no GitHub Pages (`output: 'export'` no `next.config.ts`). Não use server actions, route handlers, proxy ou `next/headers`. Publique com `python ../.agent/scripts/publish_github.py . -m "<msg>" --wait` após validação verde e autorização do usuário.
- **Visual:** a skill [`frontend-design`](./.claude/skills/frontend-design/SKILL.md) é a única responsável por decisões visuais (cores, tipografia, espaçamento, layout, componentes). Agentes de frontend cuidam de funcionalidade, estado, testes e acessibilidade, e seguem o [guia visual](./docs/GUIA-VISUAL.md). Padrão obrigatório: Tailwind CSS + shadcn/ui; não escreva CSS à mão nem crie classes próprias.
- Leia [PROJECT_STATE.md](./PROJECT_STATE.md) para retomar o estado atual; mantenha-o e o índice global atualizados após mudanças relevantes.
- Persistência: **Supabase com login** autorizado pelo usuário em 2026-11-15 (Supabase Auth + RLS só para autenticados; ver [docs/SUPABASE.md](docs/SUPABASE.md) e `supabase/schema.sql`). Sem as variáveis `NEXT_PUBLIC_SUPABASE_*`, o sistema usa só o navegador (IndexedDB, autorizado em 2026-11-13). Use apenas a chave `anon` no cliente; nunca a `service_role`. Não adicione outros serviços externos sem autorização. O usuário pode apagar tudo pelo botão "Limpar dados importados".
- Apuração: KPIs e contagens por cargo são calculados depois da importação (`lib/folha/apuracao.ts`): servidores ativos contados pela coluna "Descrição do cargo" do e-Cidade (todos, não só comissionados); custo = salário da tabela salarial × servidores; vagas livres = saldo do teto ÷ salário do cargo.
- Ponto de retorno antes do Supabase: branch `ponto-antes-supabase`.
- Arquivos reais de exemplo ficam em `amostras/` (fora do Git) e nunca entram em fixtures, commits ou logs.
- Trate dados pessoais como sensíveis; não use dados reais em fixtures, logs ou testes.
