# Estado do projeto — Controle de Colaboradores

**Atualizado em:** 2026-11-12  
**Pasta:** `Controle_Colaboradores`  
**Plano:** [controle-colaboradores.md](./controle-colaboradores.md)

## Importação v2 + redesign (2026-11-13, commit local, aguardando autorização de publicação)

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
