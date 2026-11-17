# Proposta: remuneração de terceirizados (tabela da Prefeitura x cadastro da empresa)

Data: 2026-11-17. Somente agregados (funções, empresas, lotações, contagens). Nenhum nome, matrícula ou CPF.
Premissas do dono do produto: o valor da TABELA SALARIAL é **salário (remuneração)**, não valor de posto; a tabela é da Prefeitura de Maricá e é a **fonte oficial**; o CADASTRO FUNCIONAL vem de cada empresa/autarquia; todo filtro e normalização acontecem **na importação**.

## 0. Qual arquivo é o "atualizado" (achado importante)

- `ARQUIVOS DE EXEMPLO/TABELA SALARIAL.xlsx` (12:54) **não foi atualizado**: é idêntico, célula a célula, à versão do commit `e852c9c` (abas `Comissionado`/`Terceirizado`, só 112 de 484 linhas com valor, todas nas linhas 2 a 113).
- A versão atualizada está em `C:/Users/CleidsonGama/Desktop/TEMP/TABELA SALARIAL.xlsx` (15:54): abas renomeadas para `Remuneração-Comissionado` e `Remuneração-Terceirizado`, cabeçalho `FUNÇÃO`/`REMUNERAÇÃO` nas duas, **459 de 484 linhas com valor**. Mesmas funções, na mesma ordem; 99 valores mudaram, 359 novos, 12 apagados, 1 igual. A análise abaixo usa **esta** versão. Ação: o usuário substituir o arquivo em `ARQUIVOS DE EXEMPLO/` (pasta fora do Git).
- O parser atual lê a nova versão sem mudança: origem pela aba (`terceir`/`comiss` em `tabela-salarial.ts:32-38`), 21 + 469 funções, avisos: 24 sem valor, 5 repetidas com valores diferentes, 10 repetidas iguais. As 9 linhas em branco no fim da aba Comissionado são ignoradas.
- Causa da divergência antiga (255%, 168%, 269%): os valores da versão anterior não eram salário. A razão antigo/novo varia de 0,45 a 4,73 por função (não há fator constante), ou seja, eram valores de outra natureza (posto/contrato ou preenchimento provisório), já corrigidos pela Prefeitura.

## 1. Reanálise: CADASTRO_TER x aba Remuneração-Terceirizado

22 terceirizados, 5 funções, 3 empresas, 4 lotações. Dentro de cada grupo função+empresa todos têm o mesmo valor.

| Função | Empresa | Pessoas | Valor na planilha | Valor na tabela | Diferença (tabela - planilha) | Situação |
|---|---|---|---|---|---|---|
| SERVENTE | ARPOADOR SOMAR | 7 | 1.851,90 | 1.851,90 | 0 | Confere |
| AUXILIAR DE FARMÁCIA | AVANT | 5 | 2.661,55 | 3.150,87 | **+489,32 (+18,4%)** | Diverge |
| ASSENTADOR DE CANALIZAÇÃO | GENERAL | 4 | 2.868,80 | 2.868,80 | 0 | Confere |
| AGENTE DE COMBATE ÀS ENDEMIAS | AVANT | 3 | 3.890,40 | 3.890,40 | 0 | Confere |
| ROÇADOR | ARPOADOR SOMAR | 3 | 1.851,90 | **sem valor no import** (a tabela tem 1.851,90) | 0 se corrigido | Falso "sem valor" |

Resultado real pelo código (`conferirTerceirizados`, via node): 22 conferidos, **5 divergentes**, 1 função sem valor.

Causas investigadas:
- **ROÇADOR (bug de importação, não de dado):** a aba tem `ROCADOR` (linha 335, vazio) e `ROÇADOR` (linha 336, 1.851,90). As duas normalizam para a mesma chave e o parser fica com a **primeira**, mesmo vazia (`tabela-salarial.ts:60-68`; `funcionarios.ts:95`; o mesmo padrão em `apuracao.ts:70`). Com "primeiro valor não vazio vence", o ROÇADOR confere.
- **AUXILIAR DE FARMÁCIA (divergência real, uma empresa, uma função):** diferença constante de R$ 489,32 nas 5 pessoas; não é fator de outra coluna (Alimentação = 660,00 não explica). Hipótese a confirmar com a Prefeitura/AVANT: adicional (ex.: insalubridade/periculosidade de cerca de 30% sobre uma base de cerca de R$ 1.631) incluído na tabela e não na planilha, ou piso de convenção diferente. A outra função da AVANT confere, então não é regra da empresa toda.
- Lotações envolvidas: CENTRO DE ABASTECIMENTO FARMACÊUTICO - CAF (5, a função divergente), GERÊNCIA EM SAÚDE (3), SANEMAR (4), SOMAR (10).

Totais mensais de remuneração dos terceirizados (sem alimentação):

| Recorte | Informado (planilha) | Pela tabela | Diferença |
|---|---|---|---|
| ARPOADOR SOMAR (10) | 18.519,00 | 18.519,00 (com a correção do ROÇADOR) | 0 |
| AVANT (8) | 24.978,95 | 27.425,55 | +2.446,60 (+9,8%) |
| GENERAL (4) | 11.475,20 | 11.475,20 | 0 |
| **Total (22)** | **54.973,15** | **57.419,75** | **+2.446,60 (+4,45%)** |

Alimentação dos terceirizados: 17.490,00 (não está na tabela; continua vindo da planilha).

Qualidade da aba Terceirizado (afeta outras empresas no futuro): 25 linhas sem valor (24 funções únicas), entre elas variantes de grafia (`ROCADOR`/`ROÇADOR`, `TOPOGRAFO`/`TOPÓGRAFO`), nomes de cargos comissionados (`ASSESSOR 2-AS 2`, `5`, `6`) e `NÃO INFORMADO`. Repetidas com valores diferentes: BOMBEIRO HIDRÁULICO (3.393,47 / 2.868,80), MÉDICO CLÍNICO (20.764,72 / 15.542,60), MÉDICO RT (20.764,72 / 10.224,20), TÉCNICO DE SEGURANÇA DO TRABALHO (3.035,56 / 4.441,20 duas vezes), TOPÓGRAFO (4.940,62 / vazio). Hoje vale a primeira; a Prefeitura precisa corrigir.

### CADASTRO_COM x aba Remuneração-Comissionado

12 pessoas, 7 funções, empresa PREFEITURA DE MARICÁ, 11 lotações: **12 iguais, 0 divergentes, 0 sem par** (ASSESSOR 6 - AS 6 (4) 1.647,82; ASSESSOR 1 (2) 6.812,77; ASSESSOR 5 (2) 2.247,02; ASSESSOR 4, ASSESSOR 2, GERENTE - CNE 7 e SUBSECRETÁRIO - CNE 1 com 1 cada). Total 59.292,80 informado = tabela. A aba Comissionado não mudou de valores (só de nome e cabeçalho).

## 2. Soluções

### (a) Tabela da Prefeitura prevalece (RECOMENDADA)

O valor oficial de cada pessoa é o da tabela, pela origem (Comissionado com a aba Comissionado, Terceirizado com a aba Terceirizado). A remuneração da planilha vira **"Remuneração informada"**, guardada para conferência. Divergência = informada diferente da tabela (centavo exato).
- Prós: coerente com a fonte oficial; o custo não depende de erro da empresa; gera relatório objetivo para cobrança/correção; um único conceito para COM e TER.
- Contras: função sem valor na tabela fica sem custo oficial (regra: usar o informado com selo "Sem referência na tabela" e contar à parte); a qualidade da tabela passa a ser crítica (os 24 sem valor e as 5 repetidas divergentes precisam de aviso claro na importação).

### (b) Tolerância configurável

Igual a (a), mas só marca divergência acima de X reais ou Y% (em Configurações).
- Prós: absorve arredondamento.
- Contras: hoje as diferenças são 0 ou 18,4%, não há arredondamento a absorver; uma tolerância mal configurada esconde a diferença real. Vale só como evolução de (a), com padrão 0.

### (c) Regra por empresa/função

Exceções cadastradas (ex.: "AVANT / AUXILIAR DE FARMÁCIA: aceitar 2.661,55" ou "mais adicional de 489,32").
- Prós: modela acordos contratuais legítimos.
- Contras: cria uma segunda tabela fora da oficial (contraria a premissa), exige tela e persistência novas e mascara o problema que deveria ser corrigido na origem. Não recomendada agora; reavaliar se a Prefeitura confirmar adicionais por contrato.

### Como (a) aparece para o usuário

- **Importação** (resultado do cartão): alerta-resumo "Conferência de remuneração: 5 pessoas com valor diferente da tabela (AVANT, 1 função); 0 funções sem valor". Avisos da tabela com os **nomes das funções** (sem valor; repetidas com valores diferentes), não só números de linha.
- **Funcionários, tabela de pessoas:** colunas `Remuneração (tabela)` (oficial), `Remuneração informada`, `Diferença` (em reais) e `Situação` (selo: Confere, Diverge, Sem valor na tabela, Fora da tabela, Não informada). Filtro novo "Situação". O CSV exportado (`funcionarios.csv`) leva as 4 colunas.
- **Funcionários, painel "Conferência de remuneração"** (substitui o atual de terceirizados, `employees-view.tsx:230-300`): cobre COM e TER, agrupado por **empresa e função**, com pessoas, valor da tabela, valores informados, diferença unitária e total mensal; botão **"Exportar divergências (CSV)"** gerando `divergencias-remuneracao.csv` com Empresa, Origem, Função, Lotação, Pessoas, Valor tabela, Valor informado, Diferença unitária, Diferença mensal (agregado, sem nomes, pronto para enviar à empresa).
- **KPIs** (`KpiStrip`): "Soma de remuneração" e "Custo mensal total" passam a usar a tabela (mais alimentação), com a nota "Pela tabela da Prefeitura"; KPI novo "Diferença informada x tabela" (hoje +2.446,60 reais, 5 pessoas), destacado quando diferente de 0.
- **Subtotais** (`SubtotaisPanel`, por origem e por empresa): coluna oficial, coluna informada e diferença. Impacto hoje: Terceirizados 54.973,15 passa a 57.419,75; AVANT 24.978,95 passa a 27.425,55; Custo mensal total (COM+TER) 138.903,95 passa a 141.350,55. Comissionados sem mudança.
- Sem tabela salarial importada: tudo continua pelo informado, com o aviso "Importe a tabela salarial para conferir" (comportamento atual).

## 3. Mudanças de código para (a) (não implementadas)

1. `lib/import/tabela-salarial.ts` (`finish`, `:57-71`): em funções repetidas, **o primeiro valor não vazio vence** (corrige ROÇADOR); avisos com a lista de funções afetadas (sem valor; repetidas com valores diferentes, mostrando os dois valores). Exportar uma função única `chaveFuncao` (hoje `normalizeHeader` é repetido em 3 arquivos).
2. `lib/import/types.ts`: em `ColaboradorPlanilha`, campos opcionais (compatíveis com dados já salvos) `remuneracaoTabela: number | null` e `situacaoRemuneracao` (confere, diverge, sem-valor, fora-da-tabela, nao-informada); `remuneracao` continua sendo o informado.
3. Novo `lib/folha/conciliacao.ts`: `conciliarRemuneracao(rows, tabela)` devolve as linhas enriquecidas e o resumo por empresa/função/origem (generaliza `conferirTerceirizados` para COM e TER; remover este e ajustar `tests/funcionarios.test.mjs`).
4. Importação (`components/import-workspace.tsx`, `save()` `:403-417`, com `lib/storage/*`): ao salvar a planilha, conciliar com a tabela já armazenada; ao salvar a tabela, reconciliar a planilha armazenada e regravá-la. Assim a normalização fica na importação (regra do dono). Os registros são `jsonb` (`supabase/schema.sql:11`): sem migration.
5. `lib/folha/funcionarios.ts`: `Soma` ganha `remuneracaoInformada` e `diferenca`; `subtotais` e `custoMensal` usam o valor da tabela quando existir, senão o informado.
6. `lib/folha/apuracao.ts:65-71`: mesma regra "primeiro valor não vazio" (e `chaveFuncao`), para o Painel/Orçamento não herdarem o bug.
7. `components/employees-view.tsx`: colunas novas em `PLANILHA_COLUMNS` (`:35-60`), filtro Situação, KPIs (`:216-226`), painel de conferência COM+TER com exportação (`lib/export-data.ts`, `buildCsvBlob` com `neutralizeFormula`).
8. Testes: `tests/tabela-salarial.test.mjs` (repetida vazia + preenchida), novo `tests/conciliacao.test.mjs` (confere, diverge, sem valor, fora da tabela, por origem, totais em centavos), `tests/amostras-reais.test.mjs` (só contagens: 22 conferidos, 5 divergentes, 0 sem valor). Fixtures sintéticas.
9. Docs: `AGENTS.md` (linha "Fontes por tela": custo de Funcionários = tabela; planilha = informado), `PROJECT_STATE.md`, `docs/DIRETRIZ-IMPORTACAO-V2.md`.

Pendências para o dono: confirmar a causa dos +489,32 do AUXILIAR DE FARMÁCIA (AVANT); pedir à Prefeitura a correção das 24 funções sem valor e das 5 repetidas com valores diferentes; substituir o arquivo em `ARQUIVOS DE EXEMPLO/`.
