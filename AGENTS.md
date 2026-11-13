# Fluxo de trabalho do projeto

- Antes de planejar ou delegar, siga a [governança](../.agent/rules/GOVERNANCA.md), o [roteiro](../.agent/rules/roteirodeconstrucao.md) e as responsabilidades do [orquestrador](../.agent/agents/orchestrator.md).
- Publicação: site estático no GitHub Pages (`output: 'export'` no `next.config.ts`). Não use server actions, route handlers, proxy ou `next/headers`. Publique com `python ../.agent/scripts/publish_github.py . -m "<msg>" --wait` após validação verde e autorização do usuário.
- Leia [PROJECT_STATE.md](./PROJECT_STATE.md) para retomar o estado atual; mantenha-o e o índice global atualizados após mudanças relevantes.
- Preserve o protótipo como processamento local: não adicione backend, autenticação ou serviços externos sem requisitos e autorização explícitos. Persistência **somente no navegador (IndexedDB)** foi autorizada pelo usuário em 2026-11-13 para os dados importados (ver [docs/DIRETRIZ-IMPORTACAO-V2.md](docs/DIRETRIZ-IMPORTACAO-V2.md)); nada é enviado a servidores, e o usuário pode apagar tudo pelo botão "Limpar dados importados".
- Arquivos reais de exemplo ficam em `amostras/` (fora do Git) e nunca entram em fixtures, commits ou logs.
- Trate dados pessoais como sensíveis; não use dados reais em fixtures, logs ou testes.
