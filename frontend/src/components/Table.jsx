import React from "react";

export default function Table({
  columns = [],
  data = [],
  keyField = "id",
  emptyText = "No data",
  className = "",
}) {
  return (
    <div className={`ui-card overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="ui-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={row[keyField] ?? idx}>
                {columns.map((c) => (
                  <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!data?.length && (
        <div className="p-6 text-center text-sm text-mute">{emptyText}</div>
      )}
    </div>
  );
}
