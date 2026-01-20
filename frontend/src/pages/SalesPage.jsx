// frontend/src/pages/SalesPage.jsx
import { useEffect, useState } from 'react'

const API_ORIG = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const API_BASE = API_ORIG.replace(/\/api$/, "");
const url = (p) => `${API_BASE}${p.startsWith('/') ? p : `/${p}`}`;

export default function SalesPage(){
  const [rows,setRows] = useState([])
  const [count,setCount] = useState(0)
  const [q,setQ] = useState('')
  const [page,setPage] = useState(1)
  const [limit,setLimit] = useState(50)
  const [details,setDetails] = useState(null)

  async function load(){
    const res = await fetch(url('/api/sales') + `?page=${page}&limit=${limit}&q=${encodeURIComponent(q)}`, { credentials:'include' })
    const d = await res.json()
    setRows(d.rows||[]); setCount(d.count ?? d.total ?? 0)
  }
  useEffect(()=>{ load().catch(()=>{}) },[page,q,limit])

  function openDetails(row){
    setDetails(row)
  }

  return (
    <div className="p-4 space-y-3 sales-page">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Sales</h1>
        <div className="flex items-center gap-2">
          <input value={q} onChange={e=>{setPage(1); setQ(e.target.value)}} placeholder="Search by invoice or customer" className="border rounded px-3 py-2"/>
          <select
            value={limit}
            onChange={e=>{ setPage(1); setLimit(Number(e.target.value||50)); }}
            className="border rounded px-3 py-2"
            title="Rows per page"
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
          <button className="btn-gold" onClick={()=>load().catch(()=>{})}>Refresh</button>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-mute">
          Showing <b>{rows.length}</b> of <b>{count}</b>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-gold px-3 py-1 rounded"
            onClick={()=>setPage(p=>Math.max(1, p-1))}
            disabled={page <= 1}
            type="button"
          >
            Prev
          </button>
          <span>Page <b>{page}</b> / <b>{Math.max(1, Math.ceil((count||0)/limit))}</b></span>
          <button
            className="btn-gold px-3 py-1 rounded"
            onClick={()=>setPage(p=>p+1)}
            disabled={page * limit >= (count||0)}
            type="button"
          >
            Next
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="p-2">Invoice No</th>
              <th className="p-2">Customer</th>
              <th className="p-2">Date &amp; Time</th>
              <th className="p-2">Total</th>
              <th className="p-2">Payment Method</th>
              <th className="p-2">Profit</th>
              <th className="p-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id || `${r.invoiceNo}-${r.createdAt}`} className="border-b">
                <td className="p-2">{r.invoiceNo || r.invoiceNumber}</td>
                <td className="p-2">{r.clientName || r?.client?.name || ''}</td>
                <td className="p-2">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</td>
                <td className="p-2">{Number(r.total||0).toFixed(2)}</td>
                <td className="p-2">{r.paymentMethod}</td>
                <td className="p-2">{Number(r.profit||0).toFixed(2)}</td>
                <td className="p-2">
                  <button className="btn-gold px-3 py-1 rounded" onClick={()=>openDetails(r)}>Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {details && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center" onClick={()=>setDetails(null)}>
          <div className="bg-white rounded-xl p-4 w-full max-w-2xl text-black" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold">Invoice Details {details.invoiceNo || details.invoiceNumber}</div>
              <button className="btn-gold" onClick={()=>setDetails(null)}>Close</button>
            </div>
            <div className="text-sm mb-2">
              Customer: {details.clientName || details?.client?.name || '—'} • Date: {details.createdAt ? new Date(details.createdAt).toLocaleString() : '—'}
            </div>
            <table className="w-full text-sm">
              <thead><tr><th className="p-2 text-left">Item</th><th className="p-2">Qty</th><th className="p-2">Sale Price</th><th className="p-2">Cost</th><th className="p-2">Subtotal</th></tr></thead>
              <tbody>
                {(details.items||[]).map((it,idx)=>(
                  <tr key={idx} className="border-b">
                    <td className="p-2 text-left">{it.name || it?.product?.name || ''}</td>
                    <td className="p-2 text-center">{it.qty}</td>
                    <td className="p-2 text-center">{Number(it.price||0).toFixed(2)}</td>
                    <td className="p-2 text-center">{Number(it.cost||0).toFixed(2)}</td>
                    <td className="p-2 text-center">{Number((Number(it.qty||0) * Number(it.price||0)) || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right mt-3">
              <div>Total: <b>{Number(details.total||0).toFixed(2)}</b></div>
              <div>Profit: <b>{Number(details.profit||0).toFixed(2)}</b></div>
              <div>Payment: <b>{details.paymentMethod}</b></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
