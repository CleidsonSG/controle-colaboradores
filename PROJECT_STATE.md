# Estado do projeto — Controle de Colaboradores

**Atualizado em:** 2026-11-11  
**Pasta:** `Controle_Colaboradores`  
**Plano:** [controle-colaboradores.md](./controle-colaboradores.md)

## Situação

Protótipo local em Next.js App Router, React e TypeScript. A navegação dos oito módulos está disponível; as áreas ainda não implementadas são identificadas como preparação. O fluxo funcional é a importação local de CSV, XLSX e XLSM, com seleção de aba, mapeamento, validação e prévia. Nenhum dado é gravado ou enviado.

## Verificação

- `npm test`: 8 testes aprovados cobrindo CSV/XLSX/XLSM, fórmulas, validação, mapeamento e limites.
- `npm run lint`, `npm run typecheck` e `npm run build`: aprovados.
- Smoke test de produção no navegador: `/` e `/dashboard` carregaram corretamente; a rota Dashboard não apresenta métricas fictícias.
- Fluxo de importação testado pela interface com CSV sintético: contagem de linhas válidas/inválidas, mensagem de erro de mês, CPF oculto por padrão e limpeza completa do estado/arquivo aprovados.
- Busca no código de `app/`, `components/` e `lib/` não encontrou chamadas de rede, armazenamento local nem logs de console.
- Suíte executada com Node.js v24.17.0; o Node emite um aviso de detecção de módulo ao importar o parser TypeScript diretamente, sem falha nos testes.

## Limites e pendências

- Campos obrigatórios, duplicidades, atualização/mesclagem e comportamento após a prévia ainda não foram aprovados como regras de negócio.
- Não há backend, banco, autenticação, retenção ou implantação.
- XLSM é lido como planilha; macros não são executadas. CSV é aceito em UTF-8.

## Próximo passo

Fazer uma revisão detalhada de acessibilidade e confirmar regras de negócio antes de ampliar a importação para persistência ou desenvolver módulos operacionais.
