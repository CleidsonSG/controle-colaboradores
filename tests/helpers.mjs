import { IMPORT_FIELDS } from "../lib/import-data.ts";

/** Independent oracle: appends both CPF check digits to a 9-digit synthetic base. */
export function makeCpf(base) {
  let digits = base;
  for (const length of [9, 10]) {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    digits += String(remainder === 10 ? 0 : remainder);
  }
  return digits;
}

export function maskCpf(digits) {
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export const FIRST_RECORD = 2;

const EMPLOYEE_DEFAULTS = {
  registration: "M-001",
  name: "Pessoa Teste",
  cpf: "",
  position: "Analista",
  unit: "Setor A",
  phone: "",
  mobile: "",
  year: "2025",
  month: "3",
};

const STATISTICS_DEFAULTS = { position: "Analista", quantity: "4", year: "2025", month: "3" };

const DEFAULTS = { employees: EMPLOYEE_DEFAULTS, "position-statistics": STATISTICS_DEFAULTS };

/** Builds a ParsedFile whose columns follow IMPORT_FIELDS order, plus the identity mapping. */
export function makeSource(type, rowOverrides) {
  const fields = IMPORT_FIELDS[type];
  const rows = rowOverrides.map((overrides, index) => ({
    record: FIRST_RECORD + index,
    values: fields.map((field) => ({ ...DEFAULTS[type], ...overrides })[field.key]),
  }));
  const source = {
    kind: "csv",
    sheetNames: ["Arquivo CSV"],
    sheetName: "Arquivo CSV",
    headers: fields.map((field) => field.label),
    rows,
  };
  const mapping = Object.fromEntries(fields.map((field, index) => [field.key, String(index)]));
  return { source, mapping };
}
