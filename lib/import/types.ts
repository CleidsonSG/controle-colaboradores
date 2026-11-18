export type ImportKind = "ecidade" | "planilha" | "salarial";

/** Linha da tabela salarial: uma função (cargo) e a remuneração mensal (em reais). */
export type CargoSalario = {
  cargo: string;
  salario: number | null;
  linha: number;
  /** Aba de onde veio (Comissionado ou Terceirizado); ausente em CSV ou aba única. */
  origem?: Origem;
};

export type ServidorECidade = {
  matricula: string;
  nome: string;
  descricaoCargo: string;
  lotacao: string;
  admissao: string | null;
  rescisao: string | null;
  comissionado: boolean;
};

export type Origem = "Comissionado" | "Terceirizado";

/** Conferência da remuneração informada com a tabela salarial da Prefeitura (referência; não altera o custo). */
export type SituacaoRemuneracao = "confere" | "diverge" | "sem-valor" | "fora-da-tabela" | "nao-informada";

export type ColaboradorPlanilha = {
  matricula: string;
  servidor: string;
  empresaSecretaria: string;
  lotacao: string;
  funcao: string;
  /** Remuneração informada na planilha da empresa: é o valor que vale (custo e totais). */
  remuneracao: number | null;
  /** Valor da tabela salarial para a função (reais); null = sem valor ou fora da tabela. Opcional: dados antigos não têm. */
  remuneracaoTabela?: number | null;
  situacaoRemuneracao?: SituacaoRemuneracao;
  alimentacao: number | null;
  indicacao: string;
  origem: Origem;
  linha: number;
  possivelDuplicidade: boolean;
  /** Preenchido só na leitura, quando a remuneração foi alterada no sistema (nunca gravado no dataset). */
  ajuste?: AjusteAplicado;
};

/** Auditoria visível do ajuste aplicado a um registro (selo "Ajustado no sistema"). */
export type AjusteAplicado = { valorAnteriorCentavos: number | null; alteradoPorNome: string; alteradoEm: string };

/** Competência mensal no formato "AAAA-MM". */
export type Competencia = string;

/** Retrato funcional de uma pessoa numa competência. Sem valores, indicação ou CPF (minimização, LGPD). */
export type RetratoFuncional = {
  competencia: Competencia;
  chaveIdentidade: string;
  origem: Origem;
  matricula: string;
  nome: string;
  empresaSecretaria: string;
  funcao: string;
  lotacao: string;
  possivelDuplicidade: boolean;
};

export type CompetenciaImportada = { competencia: Competencia; fileName: string; importedAt: string; total: number };

export type NovoAjuste = { importedAt: string; posicao: number; origem: Origem; linha: number; valorCentavos: number };

export type AjusteRemuneracao = NovoAjuste & {
  id: number;
  nome: string;
  valorAnteriorCentavos: number | null;
  alteradoPorNome: string;
  alteradoEm: string;
};

export type ImportWarning = {
  code:
    | "linha-ignorada"
    | "data-invalida"
    | "valor-invalido"
    | "duplicidade"
    | "formula-sem-valor"
    /** Relatório do e-Cidade de tipo inesperado (ex.: demitidos). */
    | "relatorio"
    /** Registros do e-Cidade sem a marca 282/16, fora da contagem do Painel. */
    | "nao-comissionado"
    /** Função repetida na tabela salarial com valores diferentes. */
    | "valores-divergentes"
    /** Função da tabela salarial sem remuneração. */
    | "sem-valor"
    /** Aba do cadastro funcional sem registros (não é erro). */
    | "aba-vazia";
  message: string;
  rows: number[];
};

export type ImportResult<T> = {
  kind: ImportKind;
  fileName: string;
  records: T[];
  countsBySheet: { sheet: string; origem?: Origem; count: number }[];
  warnings: ImportWarning[];
};

export type ImportErrorCode = "vazio" | "cabecalho" | "formato" | "tamanho";

export class ImportFileError extends Error {
  code: ImportErrorCode;
  missingColumns?: string[];

  constructor(code: ImportErrorCode, message: string, missingColumns?: string[]) {
    super(message);
    this.name = "ImportFileError";
    this.code = code;
    this.missingColumns = missingColumns;
  }
}

export type StoredDataset<T> = ImportResult<T> & { schemaVersion: 1; importedAt: string };

export interface DataStore {
  load(kind: "ecidade"): Promise<StoredDataset<ServidorECidade> | null>;
  load(kind: "planilha"): Promise<StoredDataset<ColaboradorPlanilha> | null>;
  load(kind: "salarial"): Promise<StoredDataset<CargoSalario> | null>;
  replace(kind: ImportKind, data: AnyStoredDataset): Promise<void>;
  clear(kind?: ImportKind): Promise<void>;
  /** Configurações informadas pelo usuário (ex.: teto da folha). Não são apagadas por clear(). */
  loadSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  /** Substitui atomicamente o retrato da competência; retorna o total gravado. */
  replaceCompetencia(meta: Omit<CompetenciaImportada, "total">, retratos: Omit<RetratoFuncional, "competencia">[]): Promise<number>;
  /** Mais recente primeiro. */
  listCompetencias(): Promise<CompetenciaImportada[]>;
  /** Competência mais recente primeiro. */
  loadHistoricoPessoa(chaveIdentidade: string): Promise<RetratoFuncional[]>;
  loadRetratosCompetencia(competencia: Competencia): Promise<RetratoFuncional[]>;
  /** Sem argumento, apaga todo o histórico. */
  clearHistorico(competencia?: Competencia): Promise<void>;
  /** Grava um ajuste de remuneração e devolve a linha com a auditoria preenchida. */
  saveAjuste(ajuste: NovoAjuste): Promise<AjusteRemuneracao>;
  /** Só o ajuste vigente (o mais recente) de cada posição daquela importação. */
  loadAjustes(importedAt: string): Promise<AjusteRemuneracao[]>;
}

export type Settings = {
  /** Teto mensal da folha em centavos; null = ainda não informado. */
  tetoFolha: number | null;
};

export const DEFAULT_SETTINGS: Settings = { tetoFolha: null };

export type AnyImportResult = ImportResult<ServidorECidade> | ImportResult<ColaboradorPlanilha> | ImportResult<CargoSalario>;
export type AnyStoredDataset = StoredDataset<ServidorECidade> | StoredDataset<ColaboradorPlanilha> | StoredDataset<CargoSalario>;
