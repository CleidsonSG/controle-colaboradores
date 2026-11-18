# Aba Funcionários: ajustes do documento e "Histórico do Funcionário"

> Fonte: `ARQUIVOS DE EXEMPLO/ABA FUNCIONÁRIOS.docx` (texto + 6 capturas) e a referência do painel "Histórico do Funcionário" enviada pelo usuário. Escrito em 2026-11-18 sobre a branch `feat/conciliacao-remuneracao` (commit `0dc8f80`, não publicado).
> LGPD: todos os exemplos deste documento são fictícios ("Pessoa Exemplo 01", "EMPRESA EXEMPLO A", CPF 000.000.000-00). Nenhum dado das planilhas reais foi copiado.

## Objetivo

Tornar a tela `/employees` a primeira aba "totalmente dinâmica e clicável" do sistema: limpar textos e colunas conforme o documento, transformar a conferência de remuneração em algo que leva direto às pessoas a ajustar, trocar toda exportação para Excel (.xlsx) ou PDF, dar à seção de terceirizados por empresa um filtro e indicadores visuais, e permitir clicar no nome de qualquer servidor para abrir o painel "Histórico do Funcionário" com cargo, lotação e mudanças mês a mês.

## O que existe hoje x o que falta

| Item | Hoje (código) | Falta |
|---|---|---|
| Subtítulo da tela | "Comissionados e terceirizados do Cadastro funcional (planilha Excel)." (`employees-view.tsx`) | Trocar texto (R1) |
| Cartão de custo com alimentação | Título "Custo com alimentação", descrição "Remuneração mais alimentação por mês, a partir do Cadastro funcional." (`custo-alimentacao.tsx`) | Trocar texto (R2) |
| KPI "Diferença informado x tabela" | Exibido na faixa de indicadores | Ocultar (R3) |
| Conferência de remuneração | 9 colunas (Empresa, Origem, Função, Pessoas, Valor tabela, Valor informado, Diferença unitária, Diferença mensal, Situação), texto da regra no cabeçalho, botão "Exportar divergências (CSV)" | 4 colunas, texto no rodapé, Situação clicável com detalhe por pessoa e edição de valor (R4 a R7) |
| Rodapé de importação | "<nome do arquivo>.xlsm, importado em …" | Sem extensão (R8) |
| Exportações | CSV na tabela e nas divergências; `.xlsx`/PDF já existem só em Indicações (`lib/export-indicacoes.ts`) | Todas em .xlsx ou PDF (R9) |
| Filtros | Empresa/Secretaria, Função, Origem, Situação | Só os três primeiros (R10) |
| Tabela "Buscar" | Servidor e Função quebram em 3 a 4 linhas | Larguras que cabem nome e função completos (R11) |
| Terceirizados por empresa | Tabela com todas as empresas | Filtro de empresas + KPIs e gráficos (R12) |
| Nome clicável e histórico | Não existe. Cada importação **substitui** a anterior (`store.replace`), então só há um retrato | Painel (R13 a R16) e histórico por competência (seção "Fonte e modelo de dados") |
| CPF | Nenhuma das três fontes tem CPF (cadastro: Matrícula, Servidor, Empresa/Secretaria, Lotação, Função, Remuneração, Alimentação, Indicação; e-Cidade: Matrícula, Nome, Descrição do cargo, Lotação, Admissão, Rescisão, Padrão) | Não exibir (ver Hipóteses) |

## Histórias

- Como gestor de pessoal, quero ver a tela Funcionários sem textos técnicos e sem indicadores que ainda não uso, para ler só o que importa. (Must)
- Como gestor, quero clicar na situação de uma função divergente e ver as pessoas que precisam de ajuste, para corrigir a remuneração sem procurar na tabela. (Must)
- Como administrador, quero corrigir a remuneração de uma pessoa sem valor ou divergente direto no detalhe, para não reimportar a planilha por um valor. (Should; depende da pergunta P2)
- Como gestor, quero exportar qualquer lista em Excel ou PDF, para enviar a quem não usa o sistema. (Must)
- Como gestor, quero filtrar os terceirizados por empresa e ver indicadores e gráficos, para comparar muitas empresas. (Should)
- Como gestor, quero clicar no nome de um servidor e ver seu histórico mês a mês (cargo, lotação, mudanças), para entender a trajetória sem abrir planilhas antigas. (Must)

## Requisitos do documento (fiéis ao docx, numerados)

**R1. Subtítulo da tela.** "Comissionados e terceirizados do Cadastro funcional (planilha Excel)." passa a ser **"Comissionados e terceirizados"** (no modo local, a frase "Os dados ficam só neste navegador." continua depois).
```gherkin
Cenário: Subtítulo sem a origem técnica
  Dado um Cadastro funcional importado
  Quando abro /employees
  Então o subtítulo começa com "Comissionados e terceirizados" e não contém "planilha Excel"
```

**R2. Cartão "Custo com alimentação".** A descrição "Remuneração mais alimentação por mês, a partir do Cadastro funcional." passa a ser **"Remuneração mais alimentação"**. O título "Custo com alimentação" e as abas Total/Comissionados/Terceirizados ficam como estão (Hipótese H2).
```gherkin
Cenário: Descrição curta do cartão de custo
  Quando abro /employees com dados
  Então o cartão "Custo com alimentação" mostra a descrição "Remuneração mais alimentação"
  E o texto "a partir do Cadastro funcional" não aparece
```

**R3. Ocultar "Diferença informado x tabela".** "Não informar no momento": o KPI sai da faixa de indicadores (que volta a 4 células: Comissionados, Terceirizados, Soma de remuneração, Custo mensal total). O cálculo continua existindo para a conferência.
```gherkin
Cenário: KPI de diferença oculto
  Quando abro /employees com tabela salarial e cadastro importados
  Então a faixa de indicadores tem 4 itens
  E o texto "Diferença informado x tabela" não aparece na página
```

**R4. Texto da regra vai para o rodapé.** "A planilha da empresa prevalece: o custo usa a remuneração informada. A tabela salarial da Prefeitura é só referência de conferência." sai do cabeçalho do cartão "Conferência de remuneração" e aparece como nota abaixo da tabela.
```gherkin
Cenário: Regra exibida como nota de rodapé
  Quando abro o cartão "Conferência de remuneração"
  Então o texto "A planilha da empresa prevalece" aparece depois da tabela e não na descrição do cabeçalho
```

**R5. Tabela da conferência com 4 colunas.** Somente **Função · Valor de referência · Valor informado · Situação** (nesta ordem). "Valor de referência" = valor da tabela salarial; "Valor informado" = remuneração do Cadastro funcional. Saem Empresa, Origem, Pessoas, Diferença unitária e Diferença mensal. Uma linha por função com valor informado único; função com mais de um valor informado mostra "Vários valores" na coluna e o detalhe lista cada pessoa (Hipótese H4).
```gherkin
Cenário: Colunas da conferência
  Quando abro o cartão "Conferência de remuneração"
  Então os cabeçalhos da tabela são exatamente "Função", "Valor de referência", "Valor informado", "Situação"
```

**R6. Situação informa divergência e é clicável.** Cada selo de Situação é um botão. Ao ativá-lo, abre o **detalhe da função**: lista das pessoas daquela função cujas linhas precisam de atenção (divergentes **e** sem remuneração), com Servidor, Empresa/Secretaria, Valor de referência, Valor informado e o motivo em texto. Ex.: função "FUNÇÃO EXEMPLO A" com 3 pessoas pendentes → o detalhe mostra as 3.
```gherkin
Cenário: Detalhe de uma função divergente
  Dado a função "FUNÇÃO EXEMPLO A" com 3 pessoas cujo valor informado difere da referência
  Quando ativo o selo "Diverge" dessa linha
  Então abre o detalhe "FUNÇÃO EXEMPLO A" listando exatamente 3 pessoas
  E cada pessoa mostra o valor de referência, o valor informado e o motivo "Valor diferente da referência"

Cenário: Sem remuneração entra no detalhe
  Dado uma pessoa da função "FUNÇÃO EXEMPLO B" sem remuneração informada
  Quando ativo o selo de Situação da função "FUNÇÃO EXEMPLO B"
  Então essa pessoa aparece com o motivo "Remuneração não informada"
```

**R7. Permitir alterar o valor no detalhe.** No detalhe da função, cada pessoa tem ação "Alterar valor" para registrar a remuneração informada. Regras em "Regras e validações" (V1 a V5); comportamento na reimportação depende da pergunta P2.
```gherkin
Cenário: Administrador corrige uma remuneração
  Dado que sou administrador e a pessoa "Pessoa Exemplo 01" está sem remuneração
  Quando altero o valor para "1.850,00" e salvo
  Então a mensagem "Remuneração atualizada." aparece
  E a pessoa sai da lista se o novo valor confere com a referência
  E os totais de remuneração e custo da tela são recalculados com o novo valor
  E a linha mostra o selo "Ajustado no sistema"

Cenário: Usuário comum não altera valores
  Dado que sou usuário aprovado sem papel de administrador
  Quando abro o detalhe de uma função
  Então a ação "Alterar valor" não aparece
```

**R8. Nome do arquivo sem extensão.** "CADASTRO FUNCIONAL.xlsm, importado em 17/11/2026, 17:22" passa a "CADASTRO FUNCIONAL, importado em 17/11/2026, 17:22" (remove a extensão final de qualquer arquivo).
```gherkin
Cenário: Rodapé sem extensão
  Dado o arquivo "CADASTRO EXEMPLO.xlsm" importado em 17/11/2026 às 17:22
  Quando abro /employees
  Então o rodapé mostra "CADASTRO EXEMPLO, importado em 17/11/2026, 17:22"
```

**R9. Toda exportação em .xlsx ou PDF.** O docx escreve ".xslx"; entendido como `.xlsx`. Cada ponto de exportação da tela oferece "Excel (.xlsx)" e "PDF": tabela de funcionários (respeitando busca e filtros), divergências da conferência, detalhe de função e histórico do funcionário. Nenhum botão gera CSV nesta tela.
```gherkin
Cenário: Exportar a tabela em Excel
  Dado 34 registros e o filtro Origem = "Terceirizado" mostrando 22
  Quando escolho "Exportar" > "Excel (.xlsx)"
  Então é baixado "funcionarios.xlsx" com 22 linhas de dados e os mesmos cabeçalhos visíveis

Cenário: Exportar em PDF
  Quando escolho "Exportar" > "PDF"
  Então é baixado "funcionarios.pdf"

Cenário: Sem CSV na tela
  Quando abro /employees
  Então nenhum controle contém o texto "CSV"
```

**R10. Filtros: somente Empresa/Secretaria, Função e Origem.** O filtro "Situação" sai da barra de filtros (a situação continua acessível pela conferência, R6).
```gherkin
Cenário: Três filtros
  Quando abro /employees
  Então a barra de filtros tem exatamente "Empresa/Secretaria", "Função" e "Origem"
```

**R11. Colunas Servidor e Função legíveis.** Na tabela "Buscar", Servidor deve caber o nome completo e Função também, sem quebrar palavra no meio. Critério: em tela de 1280 px, nome de até 40 caracteres e função de até 35 caracteres ficam em no máximo 2 linhas; a tabela pode rolar na horizontal, mas Servidor não pode ficar mais estreita que Matrícula.
```gherkin
Cenário: Nome completo visível
  Dado "PESSOA EXEMPLO COM NOME BEM LONGO 01" (36 caracteres) e a função "ASSESSOR EXEMPLO NIVEL 6 - AS 6"
  Quando vejo a tabela a 1280 px de largura
  Então o nome ocupa no máximo 2 linhas e a função no máximo 2 linhas
```

**R12. Terceirizados por empresa com filtro, KPIs e gráficos.** "Como serão muitas empresas terceirizadas, a seleção deve ser por um filtro. Seja criativo com KPIs e gráficos nesta parte." Comportamento mínimo: seletor de empresa (todas ou uma ou várias), KPIs da seleção (quantidade de pessoas, remuneração, alimentação, custo mensal, custo médio por pessoa) e um gráfico de custo mensal por empresa (ranking) com a seleção destacada. Tabela atual fica abaixo, mostrando só as empresas selecionadas. Escolha visual com `impeccable-lead`, dentro do `DESIGN.md` congelado (barras finas já previstas na "Faixa de indicadores").
```gherkin
Cenário: Filtrar uma empresa
  Dado terceirizados de "EMPRESA EXEMPLO A" (10), "EMPRESA EXEMPLO B" (8) e "EMPRESA EXEMPLO C" (4)
  Quando seleciono só "EMPRESA EXEMPLO B"
  Então o KPI de pessoas mostra 8 e a tabela tem 1 linha
  E o gráfico destaca "EMPRESA EXEMPLO B"

Cenário: Gráfico acessível
  Quando o gráfico de custo por empresa é exibido
  Então os mesmos valores estão disponíveis em texto (tabela ou lista) para leitor de tela
```

**R13. Tela dinâmica e clicável (pedido geral).** Toda informação agregada da tela leva ao detalhe que a compõe: situação da conferência → pessoas (R6); empresa no gráfico/tabela → aplica o filtro Empresa na tabela de funcionários; nome do servidor → histórico (R14).
```gherkin
Cenário: Empresa leva à lista
  Quando ativo a linha "EMPRESA EXEMPLO A" em Terceirizados por empresa
  Então o filtro Empresa/Secretaria passa a "EMPRESA EXEMPLO A" e a tabela mostra só essas pessoas
```

## Painel "Histórico do Funcionário" (pedido do usuário)

**R14. Nome clicável.** Na tabela de funcionários, o nome na coluna Servidor é um botão com aparência de link. Clique, Enter ou Espaço abrem o painel daquela pessoa.

**R15. Conteúdo do painel** (ordem da referência):
1. Cabeçalho: avatar com as iniciais (primeira letra do primeiro e do último nome), nome completo, matrícula (terceirizado sem matrícula → "Sem matrícula"); selos **Cargo atual**, **Lotação**, **Período atual** (última competência registrada, formato "mm/aaaa"). Empresa/Secretaria e Origem como texto de apoio. Sem CPF (Hipótese H6).
2. "Resumo do histórico": 4 contadores (Meses registrados, Cargos ocupados, Mudanças de cargo, Mudanças de lotação).
3. "Histórico detalhado": tabela Período (mm/aaaa) · Cargo · Lotação · Mudança, da competência mais recente para a mais antiga.
4. Ações: "Exportar" (Excel/PDF do histórico dessa pessoa) e "Fechar".

**R16. Comportamento de abertura e fechamento.**
- Desktop (≥ 768 px): diálogo modal centralizado, largura máxima 960 px, rolagem interna na tabela.
- Celular (< 768 px): ocupa a tela inteira; tabela vira lista (um bloco por competência).
- Foco vai para o título do painel ao abrir; Tab fica preso dentro do painel; Esc, botão "Fechar" ou clique fora fecham; ao fechar, o foco volta ao nome clicado.
- Título com `role="dialog"` e nome acessível "Histórico do Funcionário: <nome>".
- Não altera a URL (a URL não pode conter matrícula nem nome; LGPD).

```gherkin
Cenário: Abrir pelo nome
  Dado a pessoa "Pessoa Exemplo 01" na tabela
  Quando clico no nome "Pessoa Exemplo 01"
  Então abre o painel "Histórico do Funcionário" com o nome "Pessoa Exemplo 01" e o avatar "PE"

Cenário: Teclado
  Dado o foco no nome "Pessoa Exemplo 01"
  Quando pressiono Enter
  Então o painel abre e o foco está no título
  Quando pressiono Esc
  Então o painel fecha e o foco volta ao nome "Pessoa Exemplo 01"

Cenário: Celular em tela cheia
  Dado a tela com 390 px de largura
  Quando abro o histórico
  Então o painel ocupa 100% da largura e da altura e não há rolagem horizontal

Cenário: URL sem dado pessoal
  Quando abro e fecho o histórico
  Então a URL continua "/employees/" sem parâmetros

Cenário: Contadores com mudanças
  Dado o histórico fictício
    | Período | Cargo      | Lotação    |
    | 01/2026 | ASSESSOR 1 | SECRETARIA A |
    | 02/2026 | ASSESSOR 1 | SECRETARIA A |
    | 03/2026 | ASSESSOR 2 | SECRETARIA A |
    | 04/2026 | ASSESSOR 2 | SECRETARIA B |
  Quando abro o histórico
  Então "Meses registrados" = 4, "Cargos ocupados" = 2, "Mudanças de cargo" = 1, "Mudanças de lotação" = 1
  E a coluna Mudança mostra, de 04/2026 a 01/2026: "Lotação", "Cargo", "Sem mudança", "Início do registro"
  E "Período atual" = "04/2026", "Cargo atual" = "ASSESSOR 2", "Lotação" = "SECRETARIA B"

Cenário: Desempenho
  Dado 500 pessoas e 24 competências registradas
  Quando clico em um nome
  Então o painel completo aparece em menos de 300 ms após os dados da tela estarem carregados
```

### Regras de cálculo

Base: registros da pessoa (chave de identidade, ver modelo de dados), um por competência, ordenados por competência.

| Indicador | Regra |
|---|---|
| Meses registrados | Quantidade de competências distintas com registro da pessoa (meses sem registro não contam) |
| Cargos ocupados | Quantidade de cargos distintos após normalização (maiúsculas, sem acento, espaços colapsados, mesma grafia unificada usada na importação) |
| Mudanças de cargo | Quantidade de pares de registros consecutivos (na ordem cronológica, ignorando meses sem registro) com cargo normalizado diferente |
| Mudanças de lotação | Idem, com lotação normalizada |
| Cargo atual / Lotação | Do registro da competência mais recente |
| Período atual | Competência mais recente, "mm/aaaa" |

Coluna **Mudança** (por linha, comparando com o registro cronologicamente anterior):

| Condição | Texto |
|---|---|
| Primeiro registro da pessoa | "Início do registro" |
| Cargo e lotação iguais | "Sem mudança" (texto em cinza) |
| Só cargo diferente | "Cargo" (selo) |
| Só lotação diferente | "Lotação" (selo) |
| Ambos diferentes | "Cargo e lotação" (selo) |
| Competência anterior registrada não é o mês imediatamente anterior | Acrescenta a nota "após N meses sem registro" (N = meses do intervalo) |

Ao passar o foco ou o mouse sobre o selo (e no Excel/PDF), mostrar "de <valor anterior> para <valor novo>".

## Fonte e modelo de dados do histórico (questão central)

**Constatações (lidas no código e só nos cabeçalhos dos arquivos):**
- Cadastro funcional (.xlsm): abas de comissionados e terceirizados, colunas Matrícula, Servidor, Empresa/Secretaria, Lotação, Função, Remuneração, Alimentação, Indicação. **Sem competência, sem CPF.** Terceirizados não têm matrícula (a célula traz um texto fixo, já tratado como "não identifica ninguém" em `planilha-excel.ts`).
- e-Cidade (.csv): relatório "Funcionários admitidos" com um filtro de período no topo (data inicial a data final) e colunas Matrícula, Nome, Descrição do cargo, Lotação, Admissão, Rescisão, Padrão. É um **retrato** do cargo e lotação na data de emissão; não traz cargo/lotação por mês. **Sem CPF.**
- Tabela salarial: só função e valor.
- Armazenamento: `datasets` tem uma linha por tipo (`kind` = ecidade | planilha | salarial, chave primária); cada importação **substitui** a anterior. Logo, hoje **não existe** histórico.

**Conclusão:** nenhuma fonte atual tem histórico mensal. O histórico precisa ser **acumulado** a partir de agora: cada importação do Cadastro funcional grava um retrato da **competência** (mês/ano). Meses anteriores só existirão se o usuário tiver os arquivos mensais antigos para importar um a um (pergunta P1).

**Decisão recomendada:**
1. Na importação do Cadastro funcional, novo campo obrigatório **"Competência (mês/ano)"**, preenchido com o mês corrente e editável; não aceita mês futuro. A tela atual (retrato vigente) continua sendo o último arquivo importado, como hoje.
2. Gravar o retrato em uma **nova tabela** de histórico (não no jsonb de `datasets`): uma linha por pessoa × competência, só com o necessário: chave de identidade, matrícula (vazia para terceirizado), nome, origem, empresa/secretaria, cargo (função), lotação, competência, data da importação. **Sem remuneração, alimentação, indicação ou CPF** (minimização: o painel não usa valores).
   - Motivo de não usar `datasets`: a chave primária é o tipo, o tamanho do jsonb tem limite de 20 MB e o histórico cresce mês a mês; uma tabela permite consultar por pessoa e apagar por competência.
   - Unicidade: (chave de identidade, competência). Reimportar a mesma competência **substitui** o retrato daquela competência (com aviso "A competência 11/2026 já tem registros e será substituída").
   - Chave de identidade: comissionado = matrícula; terceirizado = nome normalizado + empresa normalizada (pergunta P4). Homônimo na mesma empresa é sinalizado como "Possível duplicidade", como já ocorre.
   - RLS igual a `datasets`: aprovados leem, só administradores inserem/alteram/apagam; `anon` sem acesso. "Limpar dados importados" passa a oferecer também apagar o histórico (confirmação com texto explícito).
   - Modo local (sem Supabase): o mesmo modelo em um novo depósito do IndexedDB.
3. Exige `database-architect` (tabela, índices, RLS, migração idempotente em `supabase/schema.sql`) e `security-auditor` antes de publicar.

**LGPD:**
- Dado pessoal: nome, matrícula, cargo, lotação, histórico funcional. Finalidade: gestão de pessoal do órgão. Base legal: execução de política pública / obrigação legal do controlador (administração pública) — registrar no `PROJECT_STATE.md`. Acesso: só usuários aprovados.
- CPF: não existe nas fontes e não será coletado (minimização). Se um dia for necessário, exibir mascarado (`***.***.***-00`, só os 2 últimos dígitos) e apenas para administradores — fora deste escopo.
- Retenção: sugerida enquanto a pessoa tiver vínculo + 5 anos; até decisão, sem exclusão automática, mas com exclusão manual por competência (Hipótese H8).
- Exportações do histórico contêm dado pessoal: o arquivo leva no rodapé "Documento com dados pessoais. Uso interno."; nome e matrícula nunca vão para URL, log ou console.

## Fluxos

**Feliz (histórico):**
1. Usuário abre `/employees`; a tela carrega o retrato atual.
2. Clica no nome "Pessoa Exemplo 01".
3. O painel abre com o cabeçalho imediatamente (dados do retrato atual) e o histórico é carregado.
4. Lê contadores e tabela; opcionalmente exporta Excel/PDF.
5. Fecha com Esc; foco volta ao nome.

**Feliz (conferência):** abre o cartão → ativa "Diverge" em uma função → vê as pessoas → (admin) "Alterar valor" → salva → lista e totais atualizam.

**Alternativos e erro:**
- Pessoa com um único registro: contadores 1/1/0/0; nota "O histórico mostra os meses importados a partir de <mm/aaaa>."
- Histórico ainda vazio (nenhuma competência gravada, ex.: dados importados antes desta versão): painel mostra cabeçalho do retrato atual e o estado "sem histórico".
- Falha de rede/servidor ao carregar o histórico: estado de erro com "Tentar novamente"; cabeçalho continua visível.
- Permissão negada (RLS, usuário pendente/bloqueado): mesma mensagem de acesso que a tela já usa; nada de dado parcial.
- Salvar valor (R7) falha: o valor anterior permanece, mensagem de erro, campo mantém o texto digitado.
- Lista da conferência vazia (tudo confere): mostra "Todas as funções conferem com a tabela de referência."

## Regras e validações

| Campo/regra | Condição | Mensagem pt-BR |
|---|---|---|
| V1 Valor (R7) | Vazio | "Informe o valor da remuneração." |
| V2 Valor (R7) | Não numérico ou negativo | "Use um valor em reais, por exemplo 1.850,00." |
| V3 Valor (R7) | Acima de R$ 100.000,00 | "Valor acima de R$ 100.000,00. Confira e salve de novo para confirmar." (segunda gravação aceita) |
| V4 Permissão (R7) | Usuário não administrador | Ação não aparece; se o banco recusar: "Só administradores podem alterar valores." |
| V5 Auditoria (R7) | Valor alterado no sistema | Selo "Ajustado no sistema" na linha, com data e nome de quem alterou no detalhe (nome do usuário do sistema, não do servidor) |
| V6 Competência (importação) | Vazia | "Informe a competência (mês/ano) deste cadastro." |
| V7 Competência | Mês futuro | "A competência não pode ser posterior ao mês atual." |
| V8 Competência | Já existe | Aviso: "A competência mm/aaaa já tem registros e será substituída." (confirmação) |
| V9 Situação "Sem valor na tabela" | Referência sem valor | Ver P3; até a resposta: selo "Sem referência", informativo, não conta como divergência |
| V10 Exportação | Lista vazia | Botão desabilitado com dica "Nada para exportar com os filtros atuais." |

## Estados de UI

| Local | Carregando | Vazio | Erro | Sucesso |
|---|---|---|---|---|
| Painel de histórico | Esqueleto dos 4 contadores e de 5 linhas; `aria-busy`; texto para leitor "Carregando histórico" | "Ainda não há histórico para esta pessoa. O histórico começa a ser registrado a cada importação mensal do Cadastro funcional." | "Não foi possível carregar o histórico. Verifique a conexão e tente de novo." + botão "Tentar novamente" | Contadores + tabela |
| Detalhe da função | Esqueleto de 3 linhas | "Nenhuma pessoa com ajuste pendente nesta função." | "Não foi possível carregar as pessoas desta função." | Lista |
| Salvar valor | Botão "Salvando…" desabilitado | — | "Não foi possível salvar. Tente de novo." | "Remuneração atualizada." (`role="status"`) |
| Terceirizados por empresa | Esqueleto dos KPIs | "Nenhum terceirizado importado." | herdado da tela | KPIs + gráfico + tabela |
| Exportação | "Gerando arquivo…" | ver V10 | "Não foi possível gerar o arquivo." | download iniciado |

## Fatias de entrega

| Fatia | Conteúdo | Agentes | Testável por |
|---|---|---|---|
| **1 (mínima)** | R1, R2, R3, R8, R10, R11 + nome clicável abrindo o painel com o **retrato atual** (cabeçalho, contadores 1/1/0/0, uma linha "Início do registro", estado "histórico começa agora"), teclado/foco/Esc, celular tela cheia. Sem banco novo | `impeccable-lead` (painel e larguras), `frontend-specialist` se preciso, `test-engineer` | unitário (cálculo dos contadores com histórico fictício) + E2E (abrir/fechar, foco) |
| 2 | R4, R5, R6 (detalhe da função, só leitura), R9 (Excel/PDF reaproveitando o padrão de Indicações), R13 (empresa → filtro) | `frontend-specialist`, `test-engineer` | E2E dos cenários R4–R6, R9 |
| 3 | Histórico real: competência na importação (V6–V8), nova tabela + RLS + IndexedDB, painel lendo o histórico, exportação do histórico | `database-architect` → `criadorBD`, `backend-specialist` (camada DataStore), `frontend-specialist`, `security-auditor` | testes de RLS, unitário do acumulado, E2E com 3 competências sintéticas |
| 4 | R7 (alterar valor) conforme P2 | `database-architect` (se o ajuste for persistido à parte), `frontend-specialist`, `security-auditor` | cenários R7 e V1–V5 |
| 5 | R12 (filtro de empresas, KPIs e gráfico) | `impeccable-lead` | cenários R12 + prévia visual |

## Perguntas que só o usuário pode responder

- **P1. De onde vêm os meses anteriores?** (a) **Começar a registrar a partir da próxima importação; cada mês importado vira uma competência (Recomendado)**; (b) tenho os arquivos mensais antigos do Cadastro funcional e vou importá-los um a um, informando a competência; (c) existe outro relatório do e-Cidade com histórico por mês que vou enviar.
- **P2. Valor alterado no sistema (R7) e a próxima importação:** (a) **o ajuste vale até a próxima importação; se a planilha nova trouxer outro valor, ela prevalece e o sistema avisa (Recomendado, mantém "a planilha da empresa prevalece")**; (b) o ajuste continua valendo sobre importações futuras até ser removido; (c) não editar no sistema, só apontar quem ajustar na planilha.
- **P3. Função sem valor na tabela de referência:** (a) **mostrar "Sem referência" como informação, sem contar como divergência e sem entrar no detalhe (Recomendado)**; (b) tratar como divergência e listar as pessoas no detalhe.
- **P4. Histórico de terceirizados (não têm matrícula):** (a) **identificar por nome + empresa, com aviso de possível duplicidade (Recomendado)**; (b) histórico só para comissionados; terceirizados abrem o painel apenas com o retrato atual.

## Fora do escopo

- CPF em qualquer tela ou exportação.
- Histórico de remuneração ou de custo por mês (o painel mostra só cargo e lotação).
- Histórico vindo do e-Cidade (o relatório atual não tem dados por mês).
- Mudança de identidade visual: segue o `DESIGN.md` congelado.
- Reimportação automática de arquivos antigos.

## Hipóteses

- H1. ".xslx" no docx = `.xlsx`.
- H2. Em "Custo com alimentação → Alterar para: Remuneração mais alimentação", muda a **descrição** do cartão (padrão do R1: retirar a referência à origem); o título fica. Se o usuário quis trocar o título, é ajuste de texto de 1 linha.
- H3. "Não informar no momento" = ocultar o KPI, sem apagar o cálculo (sem impacto H6: base no pedido).
- H4. A tabela da conferência passa de "função × empresa" para "função"; empresa aparece no detalhe por pessoa.
- H5. A exportação de divergências deixa de ser "sem nomes" porque o detalhe por pessoa é o objetivo; exportações com nome ficam disponíveis a usuários aprovados (mesmo acesso da tela).
- H6. A referência do painel mostra CPF, mas nenhuma fonte tem CPF: omitido. Matrícula é exibida (já aparece na tabela).
- H7. "Período atual" = competência mais recente registrada; no retrato sem histórico (fatia 1), a competência é o mês da data de importação.
- H8. Retenção do histórico: sem descarte automático até decisão do controlador; exclusão manual por competência disponível ao administrador.
- H9. Ordem do histórico detalhado: mais recente primeiro.

## Decisões do usuário (2026-11-18)

- **P1 Histórico:** começa na próxima importação. A importação do Cadastro funcional pede a competência (mês/ano) e acumula um retrato por competência; não há carga retroativa.
- **P2 Edição de valor:** vale até a próxima importação (a planilha da empresa continua prevalecendo); o valor fica marcado como "ajustado no sistema".
- **P3 Sem valor na tabela:** vira "Sem referência", só informativo, fora da contagem de divergências.
- **P4 Identidade dos terceirizados:** nome + empresa (comissionados: matrícula).
