# Histórico por competência e ajuste de remuneração (desenho)

Fatias 3 e 4 da aba Funcionários ([aba-funcionarios.md](features/aba-funcionarios.md), decisões P1, P2 e P4).
SQL: bloco final de [`supabase/schema.sql`](../supabase/schema.sql), igual a
[`supabase/migrations/20261118120000_historico_competencias.sql`](../supabase/migrations/20261118120000_historico_competencias.sql).

## 1. Modelo

| Tabela | Linha | Chave | Quem grava |
|---|---|---|---|
| `historico_competencias` | uma competência importada (arquivo, data, total) | `competencia` (date, dia 1) | admin, via RPC |
| `historico_retratos` | pessoa × competência (nome, matrícula, origem, empresa/secretaria, função, lotação) | `id`; único `(competencia, chave_identidade)`; FK `competencia` com `on delete cascade` | admin, via RPC |
| `ajustes_remuneracao` | uma alteração de valor (auditoria, só inclusão) | `id`; vigente = maior `id` por `(importado_em, posicao)` | admin, `insert` direto |

- Retratos **sem** remuneração, alimentação, indicação ou CPF (minimização).
- A tela "retrato vigente" continua lendo `datasets` como hoje; o histórico só alimenta o painel "Histórico do Funcionário".
- **RPC `substituir_historico_competencia(p_competencia date, p_arquivo text, p_importado_em timestamptz, p_retratos jsonb) → integer`**
  (`security invoker`, `search_path = ''`): numa transação faz upsert da competência, apaga os retratos dela e insere os novos.
  Recusa competência que não seja dia 1, mês futuro (fuso `America/Sao_Paulo`), não-array, mais de 50 000 itens ou mais de 15 MB de JSON (checado só depois de confirmar administrador). `importado_em` futuro é limitado a `now()`.
  É invoker porque a RLS de admin já basta; a checagem `is_admin()` interna só dá mensagem clara.
- Apagar uma competência: `delete from historico_competencias where competencia = ...` (cascata nos retratos).

### Por que o ajuste fica em tabela à parte (e não dentro de `datasets.records`)

1. Gravar no jsonb obrigaria regravar o conjunto inteiro (até 20 MB) para mudar um valor, com risco de sobrescrever uma importação concorrente.
2. Auditoria dentro do jsonb seria escrita pelo navegador (forjável); na tabela, o gatilho `preparar_ajuste_remuneracao` grava quem, quando, valor anterior e nome do servidor a partir do banco.
3. A regra P2 continua natural: o ajuste aponta para `importado_em` = `datasets.imported_at` da planilha; reimportar troca essa data e os ajustes antigos deixam de valer (ficam só como auditoria).

Gatilho `preparar_ajuste_remuneracao` (before insert, invoker): recusa se a planilha atual não tiver aquele `imported_at`
("O cadastro funcional foi reimportado...") ou se `records[posicao]` não bater com `origem`/`linha`; valor anterior = último
ajuste do mesmo registro ou, se não houver, `remuneracao × 100` da planilha. Sem política de `update` (auditoria imutável);
`delete` só admin, usado por "Limpar dados importados". Limite: R$ 0,01 a R$ 1.000.000,00 (o gatilho também recusa quem não é administrador, 42501) (a confirmação acima de R$ 100.000,00 é da UI, V3).

## 2. Identidade e normalização (P4)

```ts
const normalizar = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// matrícula: trim e remoção de espaços internos (zeros à esquerda preservados)
chave = matricula ? `m:${matricula}` : `n:${normalizar(nome)}|${normalizar(empresaSecretaria)}`;
```

- Comissionado → `m:<matrícula>`; terceirizado (ou quem vier sem matrícula) → `n:<nome>|<empresa>`.
- Homônimos com a mesma chave na mesma competência: o 2º em diante recebe `#2`, `#3`… (ordem do arquivo) e todos ficam com
  `possivelDuplicidade = true`. O cálculo é feito **no cliente** por uma única função (`buildRetratos`), usada nos dois modos;
  o banco só valida (formato `^(m|n):` e unicidade). Uma chave repetida faz a RPC falhar inteira, sem gravação parcial.
- Competência no TypeScript: `"AAAA-MM"`; no banco: `date` do dia 1 (`"2026-11"` ↔ `2026-11-01`).

## 3. Contrato proposto para `DataStore` (`lib/import/types.ts`)

```ts
export type Competencia = string; // "AAAA-MM"

export type RetratoFuncional = {
  competencia: Competencia; chaveIdentidade: string; origem: Origem; matricula: string; nome: string;
  empresaSecretaria: string; funcao: string; lotacao: string; possivelDuplicidade: boolean;
};
export type CompetenciaImportada = { competencia: Competencia; fileName: string; importedAt: string; total: number };
export type NovoAjuste = { importedAt: string; posicao: number; origem: Origem; linha: number; valorCentavos: number };
export type AjusteRemuneracao = NovoAjuste & {
  id: number; nome: string; valorAnteriorCentavos: number | null; alteradoPorNome: string; alteradoEm: string;
};

interface DataStore {
  // ...métodos atuais
  /** Substitui atomicamente o retrato da competência; retorna o total gravado. */
  replaceCompetencia(meta: Omit<CompetenciaImportada, "total">, retratos: Omit<RetratoFuncional, "competencia">[]): Promise<number>;
  listCompetencias(): Promise<CompetenciaImportada[]>;                 // mais recente primeiro (aviso V8)
  loadHistoricoPessoa(chaveIdentidade: string): Promise<RetratoFuncional[]>; // competência desc
  loadRetratosCompetencia(competencia: Competencia): Promise<RetratoFuncional[]>;
  clearHistorico(competencia?: Competencia): Promise<void>;           // sem argumento = tudo
  saveAjuste(ajuste: NovoAjuste): Promise<AjusteRemuneracao>;         // devolve a linha com a auditoria do banco
  loadAjustes(importedAt: string): Promise<AjusteRemuneracao[]>;       // só o vigente por posicao
}
```

Supabase: `replaceCompetencia` → `rpc('substituir_historico_competencia', { p_competencia: "2026-11-01", ..., p_retratos })` com
chaves em snake_case; leituras com colunas explícitas (sem `select *`), `historico_retratos` filtrado por `chave_identidade` e
`order('competencia', { ascending: false })`; `saveAjuste` → `insert(...).select(...)`; `loadAjustes` → `eq('importado_em', ...)`
ordenado por `id desc`, mantendo o primeiro de cada `posicao`. `clear("planilha")` e "Limpar dados importados" passam a apagar
também `ajustes_remuneracao`; o histórico só com a confirmação explícita já prevista.

## 4. Equivalente IndexedDB (`lib/storage/indexeddb-store.ts`)

`DB_VERSION` 2 → **3**; no `onupgradeneeded`, criar se não existirem:

| Object store | keyPath | Índices |
|---|---|---|
| `historicoCompetencias` | `competencia` | — |
| `historicoRetratos` | `["competencia", "chaveIdentidade"]` | `porPessoa` em `["chaveIdentidade", "competencia"]`; `porCompetencia` em `competencia` |
| `ajustesRemuneracao` | `id` (`autoIncrement`) | `porImportacao` em `["importedAt", "posicao"]` |

- `replaceCompetencia`: uma transação `readwrite` nas duas stores de histórico: `put` da competência, `delete` em
  `IDBKeyRange.bound([c], [c, []])` nos retratos, `put` de cada retrato. Mesmas validações da RPC (dia/mês futuro/tamanho).
- `loadHistoricoPessoa`: índice `porPessoa` com `IDBKeyRange.bound([chave], [chave, []])`, cursor `"prev"`.
- `saveAjuste`: lê o `dataset` da planilha; recusa se `importedAt` diferir ou `records[posicao]` não bater; preenche
  `valorAnteriorCentavos`, `nome`, `alteradoEm`; `alteradoPorNome = "Este navegador"` (modo local não tem login nem papel).

## 5. Testes sugeridos (criadorBD / security-auditor)

pgTAP em `supabase/tests/database/historico_competencias.test.sql` (perfis sintéticos: admin aprovado, usuário aprovado, pendente):

1. `anon`: `select` em `historico_competencias`, `historico_retratos`, `ajustes_remuneracao` → erro de permissão; `execute` da RPC → negado.
2. Pendente/bloqueado: `select` → 0 linhas; RPC → erro `42501`.
3. Usuário aprovado: lê as três tabelas; `insert`/`delete` → 0 linhas afetadas ou erro; RPC → `42501`; `insert` de ajuste → negado.
4. Admin: RPC duas vezes na mesma competência com 3 e depois 2 retratos → `count(*) = 2` (idempotente, substitui);
   competência `2026-11-15` ou mês futuro → erro `22023`; chave repetida no array → erro e nada gravado.
5. Admin: `insert` de ajuste com `importado_em` diferente do da planilha → erro; válido → `alterado_por = auth.uid()` e
   `valor_anterior_centavos` = valor da planilha; 2º ajuste → anterior = 1º ajuste; `update` → negado (sem política).
6. Sonda anon no projeto hospedado (skill `supabase-static` §9): `select` nas três tabelas retorna `[]`/erro e `insert` falha.

Advisors esperados limpos: `rls_disabled_in_public`, `function_search_path_mutable`, `unindexed_foreign_keys`, `auth_rls_initplan`.

## 6. LGPD

Dados pessoais: nome, matrícula, função, lotação, empresa (histórico funcional) e o valor ajustado. Finalidade: gestão de pessoal;
acesso só para aprovados; ajustes também guardam o nome do usuário do sistema que alterou. Retenção: sem exclusão automática
(hipótese H8 do documento); exclusão manual por competência e por "Limpar dados importados".
