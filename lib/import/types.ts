export type ImportKind = "ecidade" | "planilha" | "salarial";

/** Linha da tabela salarial: um cargo e o salário mensal (em reais). */
export type CargoSalario = {
  cargo: string;
  salario: number | null;
  linha: number;
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

export type ColaboradorPlanilha = {
  matricula: string;
  servidor: string;
  empresaSecretaria: string;
  lotacao: string;
  funcao: string;
  remuneracao: number | null;
  alimentacao: number | null;
  indicacao: string;
  origem: Origem;
  linha: number;
  possivelDuplicidade: boolean;
};

export type ImportWarning = {
  code: "linha-ignorada" | "data-invalida" | "valor-invalido" | "duplicidade" | "formula-sem-valor";
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
}

export type Settings = {
  /** Teto mensal da folha em centavos; null = ainda não informado. */
  tetoFolha: number | null;
};

export const DEFAULT_SETTINGS: Settings = { tetoFolha: null };

export type AnyImportResult = ImportResult<ServidorECidade> | ImportResult<ColaboradorPlanilha> | ImportResult<CargoSalario>;
export type AnyStoredDataset = StoredDataset<ServidorECidade> | StoredDataset<ColaboradorPlanilha> | StoredDataset<CargoSalario>;
