export default function Table({ columns, data, keyField = 'id' }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-mute border-b border-line">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="py-2 pr-6">{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={row[keyField] ?? idx} className="border-b border-line">
              {columns.map((c) => (
                <td key={c.key} className="py-2 pr-6">
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
