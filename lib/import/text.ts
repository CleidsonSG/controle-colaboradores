import type { ImportWarning } from "./types.ts";

/** NFD sem diacríticos, minúsculas, espaços colapsados e trim. */
export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Decodifica como UTF-8 estrito; se falhar, usa windows-1252. Remove o BOM. */
export function decodeText(buffer: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder("windows-1252").decode(buffer);
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Converte dd/mm/aaaa (ou aaaa-mm-dd) em "aaaa-mm-dd"; vazio ou data inexistente retornam null. */
export function parseDateToIso(value: string): { iso: string | null; invalid: boolean } {
  const text = value.trim();
  if (text === "") return { iso: null, invalid: false };
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/.exec(text);
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(text);
  const parts = br ? { d: br[1], m: br[2], y: br[3] } : iso ? { d: iso[3], m: iso[2], y: iso[1] } : null;
  if (!parts) return { iso: null, invalid: true };
  const day = Number(parts.d);
  const month = Number(parts.m);
  const year = Number(parts.y);
  const check = new Date(Date.UTC(year, month - 1, day));
  const valid =
    year >= 1900 && check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
  if (!valid) return { iso: null, invalid: true };
  return { iso: `${parts.y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, invalid: false };
}

/** "aaaa-mm-dd" -> "dd/mm/aaaa" para exibição. */
export function formatDateBr(iso: string | null): string {
  if (!iso) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

/** Aceita número ou texto como "R$ 1.234,56"; vazio -> null sem erro; inválido -> invalid. */
export function parseMoney(value: string | number | null): { value: number | null; invalid: boolean } {
  if (value === null) return { value: null, invalid: false };
  if (typeof value === "number") return Number.isFinite(value) ? { value, invalid: false } : { value: null, invalid: true };
  let text = value.replace(/R\$/gi, "").replace(/\s/g, "");
  if (text === "") return { value: null, invalid: false };
  const negative = text.startsWith("-");
  if (negative) text = text.slice(1);
  if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  }
  if (!/^\d+(\.\d+)?$/.test(text)) return { value: null, invalid: true };
  const number = Number(text);
  return { value: negative ? -number : number, invalid: false };
}

/** Número inteiro vira texto sem notação científica; demais valores são apenas aparados. */
export function matriculaToText(value: unknown): string {
  if (typeof value === "number") return Number.isInteger(value) ? value.toFixed(0) : String(value);
  return typeof value === "string" ? value.trim() : "";
}

/** Escolhe o delimitador mais frequente na linha (";" vence empate). */
export function detectDelimiter(line: string): string {
  const count = (char: string) => line.split(char).length - 1;
  const candidates: [string, number][] = [
    [";", count(";")],
    [",", count(",")],
    ["\t", count("\t")],
  ];
  return candidates.reduce((best, current) => (current[1] > best[1] ? current : best))[0];
}

/** Acumula avisos por código, juntando as linhas afetadas. */
export class WarningCollector {
  private readonly map = new Map<ImportWarning["code"], ImportWarning>();

  add(code: ImportWarning["code"], message: string, row: number): void {
    const existing = this.map.get(code);
    if (existing) {
      if (!existing.rows.includes(row)) existing.rows.push(row);
    } else {
      this.map.set(code, { code, message, rows: [row] });
    }
  }

  list(): ImportWarning[] {
    return [...this.map.values()];
  }
}
