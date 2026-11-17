# Análise dos arquivos de exemplo vs. código (2026-11-17)

Somente leitura. Sem nomes de pessoas, matrículas ou CPF: só colunas, contagens, agregados e nomes de funções/lotações/empresas.
Fonte: `ARQUIVOS DE EXEMPLO/` (CADASTRO FUNCIONAL.xlsm, GERAL ECIDADE.csv, TABELA SALARIAL.xlsx), lidos com openpyxl e com os parsers reais (`lib/import/*`, `lib/folha/apuracao.ts`) via Node 24. Scripts descartáveis no scratchpad.

## Resumo executivo

- Os 3 arquivos novos são lidos pelos parsers sem erro: CSV 971 registros; planilha 34 (12 comissionados + 22 terceirizados, **as duas abas são lidas**); tabela salarial 490 linhas (21 Comissionado + 469 Terceirizado após deduplicar).
- O achado anterior (3.420 com rescisão e 0 terceirizados) **não é bug de parser**. Causa: `amostras/GERAL ECIDADE.csv` (28/09, 463 KB) é o relatório **FUNCIONÁRIOS DEMITIDOS** (linha 1), período 2025-01-01 a 2026-09-28, vínculos (123,15,16,2): 100% das 3.421 linhas têm Rescisão (3.420 lidas + rodapé TOTAL 3419). E `amostras/` só tem um atalho `.lnk` do xlsm, não o arquivo; sem xlsm não há terceirizados. O arquivo novo é outro relatório, **FUNCIONÁRIOS ADMITIDOS**, 01/01/2026 a 17/11/2026, 971 linhas, só 10,5% com Rescisão. O código não lê o título (linha 1) nem distingue admitidos de demitidos.
- Conflito de regra: o CSV novo **não tem só comissionados**: 133 de 971 não têm a marca `282/16` (contratos, estagiários, estoquista etc.). Hoje o Painel conta todos (decisão registrada no AGENTS.md), gerando 115 servidores sem salário na tabela.
- A aba Terceirizado da tabela salarial **não bate** com a remuneração da planilha (12 de 12 comparáveis divergem; tabela 2,7x a 3,7x maior): parece outro conceito (custo do posto/contrato?). Hipótese, confirmar com o dono.

## 1. Estrutura por arquivo/aba

### 1.1 CADASTRO FUNCIONAL.xlsm (3 abas visíveis, sem fórmulas, sem macros VBA, sem validação nas abas de cadastro)

Cabeçalho nas duas abas de cadastro: linha 2 (linha 1 = título mesclado A1:H1: CONTROLE DE CARGOS COMISSIONADOS / TERCEIRIZADOS). Sem rodapé nem linhas vazias. Preenchimento 100% em todas as colunas.

Colunas (ambas as abas, nesta ordem): MATRÍCULA, SERVIDOR, EMPRESA/SECRETARIA, LOTAÇÃO, FUNÇÃO, REMUNERAÇÃO, ALIMENTAÇÃO, INDICAÇÃO.

| Aba | Dados | MATRÍCULA | EMPRESA/SECRETARIA | LOTAÇÃO | FUNÇÃO | REMUNERAÇÃO | ALIMENTAÇÃO | INDICAÇÃO |
|---|---|---|---|---|---|---|---|---|
| `CADASTRO_COM` (1ª) | 12 (linhas 3-14) | int, 12 distintas | 1 valor (PREFEITURA DE MARICÁ) | 11 distintas | 7 distintas | float; mín 1.647,82, máx 16.845,90, soma 59.292,80 | int; 650 (11x) e 0 (1x), soma 7.150 | 7 distintos (SEM INDICAÇÃO x5) |
| `CADASTRO_TER` (2ª) | 22 (linhas 3-24) | **texto fixo TERCEIRIZADA nas 22 linhas** (não é matrícula) | 3 empresas (ARPOADOR SOMAR 10, AVANT 8, GENERAL 4) | 4 distintas (SOMAR, CAF, SANEMAR, GERÊNCIA EM SAÚDE) | 5 distintas (SERVENTE 7, AUXILIAR DE FARMÁCIA 5, ASSENTADOR DE CANALIZAÇÃO 4, AGENTE DE COMBATE ÀS ENDEMIAS 3, ROÇADOR 3) | float; mín 1.851,90, máx 3.890,40, soma 54.973,15 | int; 621/660/1500, soma 17.490 | 6 distintos (SEM INDICAÇÃO x7) |

Funções da aba 1: ASSESSOR 1 a 6 (AS 1..AS 6), SUBSECRETARIO - CNE 1, GERENTE - CNE 7 - COMISSIONADO.

`DADOS` (3ª aba, A1:S14177, 19 colunas): aba **auxiliar de listas** (listas suspensas), não é cadastro. Colunas com cabeçalho: FUNÇÃO COMISSIONADO (21) e SIGLA (21); ÓRGÃO/SEC. (47 empresas/órgãos); LOTAÇÃO (400, e outra coluna de 14.176 linhas com 401 distintas); FUNÇÃO TERC (565, e outra de 14.176 linhas com 565 distintas). Várias colunas vazias. O código só lê as 2 primeiras abas, então ignora `DADOS` corretamente.

### 1.2 GERAL ECIDADE.csv (windows-1252, `;`, 126.623 bytes, 977 linhas)

- Linhas 1 a 4: FUNCIONÁRIOS ADMITIDOS; PERÍODO 01/01/2026 até 17/11/2026; ORDEM ALFABÉTICA; VINCULOS (123,15,16). Linha 5 = cabeçalho. Linhas 6 a 976 = 971 dados (todas com 8 campos). Linha 977 = rodapé TOTAL 971 FUNCIONÁRIOS (confere; o arquivo antigo declarava 3419 para 3420 linhas).
- Colunas exatas (com espaços à esquerda no arquivo, removidos pelo parser): `Matrícula`, `Nome`, `Descrição do cargo`, `Lotação`, `Admissão`, `Rescisão`, `PADRAO` e uma 8ª coluna sem nome (0% preenchida, sobra do `;` final).
- Preenchimento: Matrícula 100% (971 distintas); Nome 99,9%; Descrição do cargo 99,9% (33 distintas); Lotação 99,9% (59 distintas); Admissão 99,9% (86 datas distintas, todas em 2026); **Rescisão 10,5% (102 linhas, 33 datas distintas, 02/2026 a 11/2026, nenhuma futura)**; PADRAO 87,8% (15 distintos).
- PADRAO tem formato `NN-282/16` (NN = nível 01..15). 838 linhas têm `282/16`; 1 tem `01-335/21` (ASSESSOR ESPECIAL SM - AES SM); 14 têm `1` (estagiários); 118 vazias.
- Admissão por mês (2026): jan 61, fev 114, mar 129, abr 146, mai 48, jun 51, jul 137, ago 78, set 56, out 84, nov 67.
- Cargos mais frequentes: ASSESSOR 6 (202), 5 (143), 4 (132), 3 (130), 2 (72), 1 (47), ESTOQUISTA (33), ASSESSOR ESPECIAL 2 (27), ESTAGIARIO (23), AGENTE DESENV. INFANTIL (CONT) (22), CNE 5 (21), CNE 6 (21), CNE 7 (18), SUBSECRETARIO CNE 1 (16).
- Lotações com mais registros: SECRETARIA MUNICIPAL DE GRANDES OBRAS (80), SECRETARIA DE ASSISTENCIA SOCIAL E CIDADANIA (65), SECRETARIA DE EDUCACAO - ADMINISTRATIVO (51), SEC ESPECIAL DE PROMOÇAO DAS COMUNIDADES E DO MCMV (42), SECRETARIA DE URBANISMO E PLANEJAMENTO TERRITORIAL (41).

Arquivo antigo (`amostras/GERAL ECIDADE.csv`), para comparação: título FUNCIONÁRIOS DEMITIDOS, 3.421 dados, Rescisão 100%, 89 cargos, 81 lotações, 387 datas de admissão, PADRAO 79,2% (50 distintos).

### 1.3 TABELA SALARIAL.xlsx (2 abas)

| Aba (nome exato) | Cabeçalho (linha 1) | Dados | Observações |
|---|---|---|---|
| `Comissionado` | `CARGO`, `SALÁRIO` | 21 linhas, 21 distintas | Salário 100% preenchido (float, 1.647,82 a 19.790,83). Nomes truncados em 30 caracteres (ex.: COORDEN. GERAL - CNE 5 - COMIS), idênticos aos do e-Cidade. Sem linhas vazias. |
| `Terceirizado` | `FUNÇÃO`, `REMUNERAÇÃO` | 484 linhas, 469 funções únicas (normalizado) | **Só 112 das 484 linhas têm remuneração** (98 float, 14 int; 1.700 a 16.951,48); 372 sem valor (**360 funções únicas** ficam sem valor no import). 15 nomes com exatamente 30 caracteres (truncados). 14 funções repetidas (15 linhas extras); em 1 os valores divergem (1.787,20 vs 9.664,20) e vale a primeira. |

Atenção: o usuário descreveu as abas como Remuneração-Comissionado/Terceirizado e colunas FUNÇÃO/REMUNERAÇÃO. No arquivo real as abas se chamam `Comissionado` e `Terceirizado`, e a aba Comissionado usa `CARGO`/`SALÁRIO`.

## 2. Como o código lê cada arquivo e resultado real

Reprodução pelos parsers reais:

- `importFile` com os 3 arquivos sem `kind`: CSV -> `ecidade` 971; xlsm -> `planilha` 34; xlsx -> `salarial` 490. Reconhecimento automático correto.
- **e-Cidade** (`lib/import/ecidade-csv.ts`): acha o cabeçalho procurando matricula + nome nas 30 primeiras linhas (fallback linha 5); aliases Matrícula, Nome, Descrição do cargo, Lotação (obrigatórias), Admissão e Rescisão (opcionais) em `:8-15`. **Não lê** `PADRAO`, a 8ª coluna nem o título do relatório. Rodapé TOTAL é reconhecido (`:62-67`) e só vira aviso se divergir (`:80-83`). `comissionado` = qualquer célula da linha contendo `282/16` (`:17`, `:77`). Resultado: 971 lidos, 0 avisos, 838 comissionados (`282/16`), 102 com Rescisão, 971 com Admissão.
- **Ativos hoje** (`lib/folha/apuracao.ts:55-57` `estaAtivo`: sem rescisão ou rescisão posterior à data de referência = hoje): **869 ativos, 102 desligados**. Entre os ativos, 753 têm `282/16` e 116 não. Cargos apurados: 39 (32 com servidores + 7 da tabela sem servidor); 18 cargos sem salário na tabela = 115 servidores fora da tabela (todos sem marca `282/16`, 1 deles ASSESSOR ESPECIAL SM com `335/21`).
- Causa dos 3.420 com rescisão: ver resumo (relatório de demitidos). A coluna lida como rescisão (índice 5) está correta; o relatório é que continha só demitidos. Não há alerta e `apurar` devolve 0 ativos silenciosamente.
- **Planilha** (`lib/import/planilha-excel.ts`): usa as **2 primeiras abas por posição** (`:5`, `:112`): 1ª = Comissionado, 2ª = Terceirizado, independente do nome. Cabeçalho = 1ª linha (até 15) com matricula e servidor (fallback linha 2). Exige só Matrícula e Servidor (`:130`); as demais são opcionais. Resultado: `CADASTRO_COM` 12 + `CADASTRO_TER` 22 = 34, 0 avisos. A matrícula dos terceirizados é o texto TERCEIRIZADA (aceito, repetido 22x; `possivelDuplicidade` só marca matrícula presente nas duas abas, então não dispara). A aba `DADOS` é ignorada.
- **Tabela salarial** (`lib/import/tabela-salarial.ts`): reconhece qualquer aba com cabeçalho (Função|Cargo|Descrição do cargo) + (Remuneração|Salário|Salário base|Vencimento|Valor) e sem Matrícula (`:9-16`, `:93-105`); a origem sai do nome da aba (terceir/comiss) ou da posição (`:27-34`). Resultado: aba Comissionado (CARGO/SALÁRIO) aceita, 21; aba Terceirizado 469 (15 repetições descartadas com aviso `duplicidade`; 360 sem valor com aviso `valor-invalido`). Total 490, origem correta.
- **Painel** (`components/painel-cargos.tsx:263`): `apurar(ecidade.records, salarial.records, teto)`; só e-Cidade + tabela, a planilha **não** entra. `apurar` ignora linhas `origem === "Terceirizado"` da tabela (`apuracao.ts:62-70`) e conta todos os ativos com ou sem `282/16` (`:75-86`); `comissionados` é contador secundário. Chave de cruzamento = `normalizeHeader` (caixa, acentos, espaços; sem pontuação nem truncamento).
- **Orçamento** (`components/orcamento.tsx:19-23`): mesma apuração (e-Cidade + tabela + teto) via `folhaDaApuracao`, só cargos com salário > 0.
- **Funcionários** (`components/employees-view.tsx`): hoje tem 2 abas: Servidores Comissionados (e-Cidade) (padrão, `:21-24`, `:257`, colunas `:26-33`) e Terceirizados e Comissionados (Planilha) (`:35-60`). KPIs misturam e-Cidade e planilha (`:239-248`). Ou seja, o e-Cidade alimenta também Funcionários, contra a regra do usuário.
- **Importação** (`components/import-workspace.tsx`): 3 cartões; `target` pós-importação vai a `/` ou `/employees/#planilha` (`:443`); texto Envie o CSV do e-Cidade, a planilha Excel e a tabela salarial (`:452`).

## 3. Normalização e casamento de FUNÇÃO

Por registro (pessoa). Norm = caixa+acentos+espaços (igual ao código). Trunc = também pontuação e prefixo >= 20 caracteres.

| Comparação | Registros | Exato | Norm | Trunc | Funções sem par |
|---|---|---|---|---|---|
| e-Cidade (todos) x tabela Comissionado | 971 | 839 (86,4%) | 839 | 839 | 19 funções / 132 registros |
| e-Cidade só `282/16` x Comissionado | 838 | 838 (100%) | 838 | 838 | 0 |
| e-Cidade ativos x Comissionado | 869 | 754 (86,8%) | 754 | 754 | 18 funções / 115 registros |
| Planilha aba 1 x tabela Comissionado | 12 | 12 (100%) | 12 | 12 | 0 |
| Planilha CADASTRO_TER x tabela Terceirizado | 22 | 19 (86,4%) | 22 (100%) | 22 | 0 (diferença do exato é caixa/acento) |
| Planilha CADASTRO_TER x Terceirizado **com salário** | 22 | 12 (54,5%) | 12 | 12 | SERVENTE (7) e ROÇADOR (3) existem na tabela mas **sem remuneração** |
| Controle: e-Cidade x Terceirizado | 971 | 5 | 5 | 422 | irrelevante; confirma que e-Cidade não vai contra a aba Terceirizado |

A truncagem em 30 caracteres existe nos dois lados (e-Cidade e tabela), então já casam exatamente; prefixo não foi necessário.

**Funções do e-Cidade sem par na aba Comissionado** (todas sem `282/16`, exceto onde indicado): ESTOQUISTA (33), ESTAGIARIO (23), AGENTE DESENV. INFANTIL (CONT) (22), PSICOPEDAGOGO (14), FACILITADOR DE INCLUSAO (CONT) (9), AGENTE DE APOIO ESCOLAR (4), INST LINGUAGEM - INGLES - CONT (4), INST PEQ OFIC_MANICURE - CONT (4), BIBLIOTECARIO (3), ENFERMEIRO (CONTRATO) (3), GUARDA - VIDAS (3), INST PEQ OFIC_CABELEIRERO-CONT (3), INST PEQ OFIC_BARBEARIA - CONT (1), ENGENHEIRO CIVIL (1), ASSESSOR ESPECIAL SM - AES SM (1; padrão `335/21`), COORDENADOR DE TURNO (CONTRAT) (1), INST PEQ OFIC HOTELARIA TURISM (1), ENGENHEIRO DE PRODUCAO (CONTR) (1), PROFISSIONAL FISIO (CONTRATO) (1). Há ainda 1 registro de PROCURADOR GERAL - SM 3 sem `282/16` mas com par na tabela.

**Funções da tabela Comissionado sem servidor no e-Cidade (7 de 21):** SECRETARIO - SM 1, CONTROLADOR GERAL - SM 2, SUBCONTROLADOR, CHEFE DE GABINETE DO PREFEITO, OUVIDOR - CNE 4, ASSESSOR ESPECIAL, ASSESSOR ESPECIAL PGM- AES PGM (aparecem no painel com 0 ocupadas, `apuracao.ts:92-94`).

**Remuneração da planilha por pessoa vs. tabela salarial:**
- Aba Comissionado: 12 pessoas, **12 iguais, 0 divergentes**.
- Aba Terceirizado: 22 pessoas, 12 comparáveis, **12 divergentes (100%)**, 10 sem valor na tabela. AUXILIAR DE FARMÁCIA (5 pessoas): planilha 2.661,55 vs tabela 9.468,20; AGENTE DE COMBATE ÀS ENDEMIAS (3): 3.890,40 vs 14.358,97; ASSENTADOR DE CANALIZAÇÃO (4): 2.868,80 vs 7.692,31. Hipótese: a tabela terceirizada guarda o valor do posto/contrato e a planilha o pago ao trabalhador; confirmar com o dono antes de qualquer cruzamento financeiro.

Cruzamentos auxiliares (contagens): dos 12 comissionados da planilha só 2 têm matrícula no e-Cidade (batem em nome, função e lotação; 1 tem rescisão no e-Cidade). 10 das 11 lotações da planilha-COM existem no e-Cidade; 46 das 59 lotações do e-Cidade e 11/11 da planilha-COM estão na lista `DADOS`. Empresas da planilha-TER: 0 de 3 estão na lista de órgãos de `DADOS` (lista desatualizada). Funções TER da planilha: 5 de 5 na lista `DADOS`; a lista tem 565 funções e a tabela Terceirizado 484 (444 em comum).

## 4. Colunas existentes e potencial

| Origem | Coluna | Usada hoje? | Potencial |
|---|---|---|---|
| e-Cidade | Matrícula, Nome, Descrição do cargo, Lotação, Admissão, Rescisão | Sim (Painel/Orçamento usam Descrição do cargo e Rescisão; /employees mostra todas) | Lotação: custo e contagem por secretaria (59 lotações), hoje só filtro. Admissão: entradas por mês, tempo no cargo. |
| e-Cidade | `PADRAO` | **Não lida** | Nível do cargo (`NN-282/16`): critério confiável de comissionado (`282/16`, `335/21`, vazio, `1`); validar função x nível; ordenar por hierarquia. |
| e-Cidade | Título/Período/Vínculos (linhas 1-4) | Não | Distinguir ADMITIDOS de DEMITIDOS e o período; alertar importação do relatório errado; guardar o período no cartão da importação. |
| e-Cidade | 8ª coluna vazia | Ignorada | Nenhum. |
| Planilha | Matrícula, Servidor, Empresa/Secretaria, Lotação, Função, Remuneração, Alimentação, Indicação, Origem | Todas lidas e exibidas; KPIs usam só Remuneração | **Alimentação**: soma (7.150 COM + 17.490 TER) não aparece em KPI/custo; custo por pessoa = remuneração + alimentação. **Empresa/Secretaria** (3 empresas TER): custo e headcount por empresa. **Indicação**: contagem por indicação (dado político sensível, avaliar LGPD antes de agregar). **Lotação**: custo por lotação. |
| Planilha | aba `DADOS` | Ignorada | Listas válidas: validar Função/Lotação/Empresa e avisar valores fora da lista. |
| Tabela salarial | CARGO/FUNÇÃO e SALÁRIO/REMUNERAÇÃO | Sim (só a aba Comissionado entra na apuração) | Aba Terceirizado **não usada em nenhum cálculo**: base do custo de terceirizados (ressalvas: 360 funções sem valor e divergência com a planilha). |

## 5. Mudanças de código necessárias (regras do usuário)

1. `components/employees-view.tsx`: remover a aba e-Cidade (`TABS`, `ECIDADE_COLUMNS`, `ECidadePanel`, KPIs de e-Cidade, `store.load("ecidade")`, `hashToTab`); /employees passa a mostrar só a planilha, com 2 abas ou filtro Comissionado/Terceirizado e KPIs só da planilha; estado vazio apontando para o cartão da planilha.
2. `components/import-workspace.tsx`: ajustar textos e `target` pós-importação (`:443`, `:452`, `:563`, cartões `:31-43`) para dizer que o CSV alimenta só o Painel de Cargos e a planilha só Funcionários; rever a regra "envie os três arquivos" (`:301-302`, `:563`).
3. `lib/import/ecidade-csv.ts`: ler o título (linhas 1-4) e avisar/recusar se não for o relatório esperado (ADMITIDOS vs DEMITIDOS hoje passa despercebido; DEMITIDOS dá 0 ativos); opcionalmente ler `PADRAO`. Decidir as 133 linhas sem `282/16`: o dono diz que o CSV é só de comissionados, mas há contratos e estagiários. Sugestão: manter na importação e filtrar em `apurar` (só `comissionado === true`, ou mostrar como Outros vínculos), com aviso.
4. `lib/folha/apuracao.ts`: hoje conta todos os ativos (`:75-86`; AGENTS.md diz todos, não só comissionados). Para a regra do usuário, filtrar por `servidor.comissionado` (ou `PADRAO`) e atualizar AGENTS.md/PROJECT_STATE. Considerar `chaveCargo` tolerante a pontuação (hoje o casamento já é 100% entre comissionados).
5. `components/painel-cargos.tsx`: textos `:149-153`, `:272`, `:308` e a nota de rescisão; usar os rótulos Função (= Descrição do cargo) e Servidor (= Nome); opcional: visão por Lotação.
6. `lib/import/tabela-salarial.ts`: avisar quando função repetida tem valores diferentes (1 caso real; hoje vale a primeira em silêncio, `:51-58`); mensagem específica para funções sem remuneração (360 na aba Terceirizado), indicando a aba. Nomes de aba (`Comissionado`/`Terceirizado`) e cabeçalhos (CARGO/SALÁRIO, FUNÇÃO/REMUNERAÇÃO) já são aceitos; se o dono quiser rigor (só FUNÇÃO/REMUNERAÇÃO), restringir os aliases (`:8-9`) e renomear no exemplo.
7. `lib/import/planilha-excel.ts`: escolher abas por nome (`CADASTRO_COM`/`CADASTRO_TER`, fallback por posição) em vez de só posição (`:112`); tratar o texto fixo TERCEIRIZADA em MATRÍCULA (não usar como chave de junção); opcional: validar Função/Lotação/Empresa contra `DADOS`.
8. Novo (se o dono quiser FUNÇÃO e REMUNERAÇÃO relacionando todas as planilhas): módulo de conciliação (ex.: `lib/folha/conciliacao.ts`) comparando Função/Remuneração da planilha com a tabela por origem, listando funções sem par e divergências (hoje: Comissionado 12/12 iguais; Terceirizado 12 divergentes + 10 sem valor). Antes, confirmar a hipótese posto x pago.
9. `tests/amostras-reais.test.mjs` e `amostras/`: desatualizados (CSV de demitidos com 3.420 linhas; xlsm ausente, só atalho). Atualizar as amostras locais (fora do Git) e as asserções (971; 12+22; 21+469), só contagens.
10. Documentação: `AGENTS.md`, `PROJECT_STATE.md`, `docs/DIRETRIZ-IMPORTACAO-V2.md` com o mapeamento de fontes por tela.

## 6. Alerta de privacidade (crítico)

`git ls-files` mostra **versionados** `ARQUIVOS DE EXEMPLO/GERAL ECIDADE.csv` e `ARQUIVOS DE EXEMPLO/TABELA SALARIAL.xlsx` (primeiro commit que os traz: `e852c9c`; o CSV atual está modificado, não commitado). O CSV contém nomes e matrículas reais. O `.gitignore` em edição (não commitado) já inclui `ARQUIVOS DE EXEMPLO/`, mas **ignorar não remove arquivo já rastreado**. Se esse commit foi para o remoto (`origin` = github.com/CleidsonSG/controle-colaboradores, repositório de Pages, público), os dados pessoais estão expostos no histórico. Ação sugerida ao orquestrador: `security-auditor` + verificar `git log origin/main -- "ARQUIVOS DE EXEMPLO"`; `git rm --cached` e, se já publicado, tratar como incidente (reescrita de histórico = gatilho H3; avisar o usuário).
