export type ImportKind = "ecidade" | "planilha";

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
  replace(kind: ImportKind, data: StoredDataset<ServidorECidade> | StoredDataset<ColaboradorPlanilha>): Promise<void>;
  clear(kind?: ImportKind): Promise<void>;
}
