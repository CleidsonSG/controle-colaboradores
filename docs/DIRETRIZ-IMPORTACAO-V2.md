# Diretriz — Importação v2 (e-Cidade CSV + Planilha XLSX/XLSM) e tela Funcionários

Origem: solicitação do usuário de 2026-11-13, refinada pelo idealizador. Esta é a fonte de verdade para backend, frontend e testes.

## Decisões do usuário (2026-11-13)

| # | Pergunta | Decisão |
|---|---|---|
| 8a | Escopo do CSV | **Importar todos** os registros (3.421 no exemplo). Aba do e-Cidade ganha filtro "Somente comissionados (282/16)", desligado por padrão. A coluna onde aparece "282/16" é desconhecida: o filtro procura o texto `282/16` em **Descrição do cargo** e, se houver, numa coluna extra guardada para isso (ver Tipo 1). |
| 8b | Matrícula repetida nas 2 abas da planilha | **Manter as duas linhas** e sinalizar `possivelDuplicidade` (selo na prévia e na tabela + aviso no resumo). Chave = matrícula + origem. |
| 8c | Reimportar | **Substituir** todo o conjunto daquele tipo, com confirmação; o outro tipo não é tocado. |
| 8d | Persistência | **IndexedDB autorizado**, com aviso de privacidade e botão "Limpar dados importados". |

## Regras de leitura

### Comum
- Tipo pela extensão: `.csv` → `ecidade`; `.xlsx`/`.xlsm` → `planilha`; outra → `ImportFileError("formato")`: "Formato não suportado. Envie um arquivo CSV, XLSX ou XLSM de até 25 MB."
- Limite 25 MB (`tamanho`); arquivo sem bytes/sem dados (`vazio`); cabeçalho não encontrado (`cabecalho`, com `missingColumns` listando as colunas esperadas que faltaram).
- `normalizeHeader`: NFD sem diacríticos, minúsculas, espaços colapsados, trim. Colunas mapeadas **pelo nome**, nunca pela posição.
- Trim em todos os valores; linhas totalmente vazias descartadas (contadas em aviso `linha-ignorada` só se tiverem conteúdo parcial inválido).
- Datas internas como string ISO `aaaa-mm-dd` (nunca `Date`); vazio → `null`; inválida (ex. 31/02) → `null` + aviso `data-invalida`. Exibição dd/mm/aaaa.
- Nenhum `console.*` com conteúdo, nenhuma chamada de rede.

### Tipo 1 — CSV e-Cidade
- Decodificação: `TextDecoder('utf-8',{fatal:true})`; se lançar, `TextDecoder('windows-1252')`. Remover BOM. Nunca mostrar erro de UTF-8.
- Linhas 1–4 = cabeçalho do relatório; achar a 1ª linha com "matricula" e "nome" normalizados (fallback: linha 5). Delimitador detectado **nessa linha** (`;`, `,`, `\t`; `;` vence empate); Papa com delimitador fixo a partir dela. CRLF.
- Colunas: Matrícula→`matricula` (texto), Nome→`nome`, Descrição do cargo→`descricaoCargo`, Lotação→`lotacao`, Admissão→`admissao`, Rescisão→`rescisao`. Ignorar coluna final vazia e PADRAO (e demais).
- `comissionado: boolean` = algum valor da linha original (inclusive colunas ignoradas, como PADRAO) contém `282/16`. Só o booleano é guardado, não a coluna.
- Aceite: `GERAL_ECIDADE.csv` → 3.421 registros, acentos corretos.

### Tipo 2 — Planilha Excel
- exceljs `xlsx.load` (nunca executar macros; .xlsm lido como dados). Percorrer **só** `worksheets` ordenadas por `orderNo`, posições 0 e 1, visíveis ou não. A 3ª+ (ex. DADOS) não é percorrida. Se o load com DADOS passar de ~5 s no arquivo real, plano B: remover a 3ª+ aba via JSZip antes do load.
- Por aba: linha 1 título; cabeçalho = 1ª linha com "matricula" e "servidor" (fallback linha 2); dados depois.
- Colunas: Matrícula, Servidor, Empresa/Secretaria, Lotação, Função, Remuneração, Alimentação, Indicação.
- Fórmula: usar `cell.value.result`; sem cache ou erro → `null` + aviso `formula-sem-valor`.
- Matrícula numérica → `String(n)` (inteiro, sem notação científica). Remuneração/Alimentação: número ou texto "R$ 1.234,56" → `number`; inválido → `null` + aviso `valor-invalido`.
- Aba 2 vazia → 0 registros, sem erro. Fusão numa lista com `origem` "Comissionado" (aba 1) / "Terceirizado" (aba 2); `countsBySheet` por aba.

## Contratos (lib/import/types.ts)

```ts
export type ImportKind = "ecidade" | "planilha";
export type ServidorECidade = { matricula: string; nome: string; descricaoCargo: string; lotacao: string; admissao: string | null; rescisao: string | null; comissionado: boolean };
export type Origem = "Comissionado" | "Terceirizado";
export type ColaboradorPlanilha = { matricula: string; servidor: string; empresaSecretaria: string; lotacao: string; funcao: string; remuneracao: number | null; alimentacao: number | null; indicacao: string; origem: Origem; linha: number; possivelDuplicidade: boolean };
export type ImportWarning = { code: "linha-ignorada" | "data-invalida" | "valor-invalido" | "duplicidade" | "formula-sem-valor"; message: string; rows: number[] };
export type ImportResult<T> = { kind: ImportKind; fileName: string; records: T[]; countsBySheet: { sheet: string; origem?: Origem; count: number }[]; warnings: ImportWarning[] };
export class ImportFileError extends Error { code: "vazio" | "cabecalho" | "formato" | "tamanho"; missingColumns?: string[] }
export type StoredDataset<T> = ImportResult<T> & { schemaVersion: 1; importedAt: string };
export interface DataStore {
  load(kind: "ecidade"): Promise<StoredDataset<ServidorECidade> | null>;
  load(kind: "planilha"): Promise<StoredDataset<ColaboradorPlanilha> | null>;
  replace(kind: ImportKind, data: StoredDataset<ServidorECidade> | StoredDataset<ColaboradorPlanilha>): Promise<void>;
  clear(kind?: ImportKind): Promise<void>;
}
```

Parsers recebem `ArrayBuffer` (testáveis no Node): `parseECidadeCsv(buf, fileName)`, `parsePlanilhaWorkbook(buf, fileName)`; `importFile(file: File)` valida tamanho/extensão e despacha.

Armazenamento: IndexedDB nativo (sem dependência nova), banco `controle-colaboradores` v1, stores `servidoresComissionadosECidade` e `colaboradoresTerceirizadosFusao`; dataset inteiro numa chave; `replace` = clear + put na mesma transação. Acesso só no cliente (useEffect/handlers). `memory-store` para testes.

## Arquivos

- **backend-specialist:** `lib/import/{types,text,ecidade-csv,planilha-excel,index}.ts`, `lib/storage/{types,indexeddb-store,memory-store,index}.ts`; `lib/export-data.ts` reduzido a `toCsv`/`neutralizeFormula`/`buildCsvBlob(headers, rows)` (mantém proteção contra injeção de fórmula); apagar `lib/import-data.ts`.
- **frontend-specialist:** reescrever `components/import-workspace.tsx` (passos 1 Arquivo → 2 Prévia → 3 Confirmação; resumo; prévia 20 linhas; diálogo de substituição; Limpar; `role="alert"`; novos textos de privacidade); `app/employees/page.tsx` + `components/employees-view.tsx` + `components/data-table.tsx`; remover `employees` do mapa de `app/[section]/page.tsx`; aba via hash (`/employees/#ecidade`, `#planilha`); estilos novos em `app/globals.css` usando os tokens de `:root`; `app-shell.tsx` com texto "dados só neste navegador".
- **test-engineer:** `tests/fixtures.mjs` (dados sintéticos em memória; CSV windows-1252 com byte 0x93, 4 linhas de relatório, PADRAO, `;` final, CRLF, linha sem Admissão/Rescisão, linha em branco; variante UTF-8 com BOM; XLSX com CADASTRO_COM/CADASTRO_TER/DADOS, fórmula com result, matrícula numérica, data, R$, matrícula repetida; aba 2 vazia; mesmo buffer como .xlsm), `tests/{ecidade-csv,planilha-excel,text,storage,export-data}.test.mjs`; teste opcional com o arquivo real via `ECIDADE_CSV`/`PLANILHA_XLSM` (skip se ausente). Apagar `import-rules.test.mjs`, `helpers.mjs` e o `import-data.test.mjs` antigo.

## Remover
`LoadType`, `IMPORT_FIELDS`, `suggestMapping`, `analyzeRows`, `resolveMapping`, CPF, ano/mês/quantidade, seletor de aba, "Tipo de carga", "Associe os campos"/"Não mapeado", textos "nenhum dado será salvo"/"Nada será gravado", `buildExport*` em XLSX. Manter o item de menu "Estatísticas de Cargo" (placeholder).
