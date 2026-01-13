// frontend/src/lib/excel.js
// SheetJS helpers for reading/writing Excel in the browser.
import * as XLSX from "xlsx";

/** Reads first worksheet to array of objects (headers from first row). */
export async function readExcelRows(fileOrBuffer) {
  let arrayBuffer;
  if (fileOrBuffer instanceof ArrayBuffer) {
    arrayBuffer = fileOrBuffer;
  } else if (fileOrBuffer && typeof fileOrBuffer.arrayBuffer === "function") {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    throw new Error("Unsupported input to readExcelRows");
  }
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  if (!wb.SheetNames || wb.SheetNames.length === 0) return [];
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

/** Simple key normalizer for header names */
export function simplifyKey(k) {
  return String(k || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Maps row keys to canonical schema based on aliases */
export function mapRowByAliases(row, aliases) {
  const out = {};
  const simplified = {};
  for (const [k, v] of Object.entries(row)) simplified[simplifyKey(k)] = v;
  for (const [target, names] of Object.entries(aliases)) {
    let val = "";
    for (const name of names) {
      const key = simplifyKey(name);
      if (key in simplified) { val = simplified[key]; break; }
    }
    out[target] = val;
  }
  return out;
}

/** Export an HTML table element to Excel */
export function exportTableToExcel(tableEl, filename = "export.xlsx") {
  if (!tableEl) throw new Error("exportTableToExcel: table element not found");
  const ws = XLSX.utils.table_to_sheet(tableEl);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename);
}

/** Export array of rows with columns definition to Excel */
export function exportRowsToExcel(rows, columns, filename = "export.xlsx") {
  const header = columns.map(c => c.title || c.key);
  const data = rows.map(r => columns.map(c => (typeof c.render === "function" ? c.render(r) : r[c.key])));
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename);
}
