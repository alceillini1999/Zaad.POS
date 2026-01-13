// frontend/src/lib/exporters.js

// CSV (من مصفوفة كائنات)
export function exportToCSV(rows, filename = "products.csv") {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = r[h] ?? "";
          const s = String(v).replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Excel (HTML table يفتح في Excel)
export function exportToExcelFromTable(tableEl, filename = "products.xls") {
  if (!tableEl) return;
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8"></head>
      <body>${tableEl.outerHTML}</body>
    </html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// PDF (نافذة طباعة)
export function exportTableToPDF(tableEl, title = "Products") {
  if (!tableEl) return;
  const wnd = window.open("", "_blank");
  if (!wnd) { alert("Popup blocked — please allow popups for this site."); return; }
  wnd.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: system-ui, sans-serif; padding: 16px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; }
          th { background: #f5f5f5; }
        </style>
      </head>
      <body>
        <h2>${title}</h2>
        ${tableEl.outerHTML}
        <script>window.onload = () => window.print();</script>
      </body>
    </html>
  `);
  wnd.document.close();
}
