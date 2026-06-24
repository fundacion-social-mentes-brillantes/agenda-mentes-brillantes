// Parser sencillo del CSV de asistentes exportado del programa contable.
// Solo extraemos lo necesario: codigo (consecutivo), nombre y activo.

export interface ParsedClientRow {
  code: number;
  name: string;
  active: boolean;
}

/** Divide una línea CSV respetando comillas dobles. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function parseClientsCsv(text: string): ParsedClientRow[] {
  const clean = text.replace(/^﻿/, ""); // quita BOM si lo trae
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idxCode = header.indexOf("codigo");
  const idxName = header.indexOf("nombre");
  const idxActive = header.indexOf("activo");
  if (idxCode === -1 || idxName === -1) {
    throw new Error('El CSV no tiene las columnas "codigo" y "nombre".');
  }

  const rows: ParsedClientRow[] = [];
  const seen = new Set<number>();
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const code = Number(String(cols[idxCode] ?? "").trim());
    const name = String(cols[idxName] ?? "").trim();
    if (!Number.isFinite(code) || !name || seen.has(code)) continue;
    seen.add(code);
    const active = idxActive === -1 ? true : String(cols[idxActive] ?? "").trim().toLowerCase() !== "false";
    rows.push({ code, name, active });
  }
  return rows;
}
