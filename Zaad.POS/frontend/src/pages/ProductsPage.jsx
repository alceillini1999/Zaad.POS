import React, { useEffect, useMemo, useRef, useState } from 'react'
import Section from '../components/Section'
import Table from '../components/Table'
import Modal from '../components/Modal'

const API_ORIG = (import.meta.env.VITE_API_URL || "").replace(/\+$/,"");
const API_BASE = API_ORIG.replace(/\/api$/,"");
const url = (p) => `${API_BASE}${p.startsWith('/') ? p : `/${p}`}`

const fmtMoney = (n) => {
  try { return new Intl.NumberFormat('en-KE',{style:'currency',currency:'KES',maximumFractionDigits:2}).format(Number(n||0)) }
  catch { const x = Number(n); return isNaN(x) ? '—' : `KSh ${x.toFixed(2)}` }
}

export default function ProductsPage(){
  const [rows,setRows] = useState([])
  const [q,setQ]       = useState('')
  const [modal,setModal] = useState({open:false, edit:null})

  async function load(){
    const r = await fetch(url('/api/products'))
    const d = await r.json()
    setRows(Array.isArray(d) ? d : [])
  }
  useEffect(()=>{ load().catch(console.error) },[])

  const filtered = useMemo(()=>{
    const s = q.trim().toLowerCase()
    return rows.filter(p =>
      String(p.name||'').toLowerCase().includes(s) ||
      String(p.barcode||p.sku||'').includes(s) ||
      String(p.category||'').toLowerCase().includes(s)
    )
  },[rows,q])

  const columns = [
    { key:'name', title:'Name' },
    { key:'barcode', title:'Barcode' },
    { key:'salePrice', title:'Sale Price', render:r=>fmtMoney(r.salePrice) },
    { key:'cost', title:'Cost', render:r=>fmtMoney(r.cost) },
    { key:'stock', title:'Qty' },
    { key:'category', title:'Category' },
    { key:'__actions', title:'Actions', render:r => (
      <div className="flex gap-2">
        <button className="btn-gold" onClick={()=>setModal({open:true, edit:r})}>Edit</button>
        <button className="btn-gold" onClick={()=>removeOne(r)}>Delete</button>
      </div>
    )},
  ]

  function addNew(){
    setModal({open:true, edit:{
      name:'', barcode:'', salePrice:0, cost:0, stock:0, unit:'', category:'', notes:''
    }})
  }

  async function save(p){
    try{
      if (!p.barcode || !p.name) { alert('Barcode and Name are required'); return; }
      const body = { barcode:p.barcode, name:p.name, category:p.category||'', cost:+p.cost||0, salePrice:+p.salePrice||0, stock:+p.stock||0, unit:p.unit||'', notes:p.notes||'' };
      const exists = rows.some(x => String(x.barcode) === String(p.barcode));
      await fetch(url(exists? `/api/products/google/${encodeURIComponent(p.barcode)}` : '/api/products/google'), {
        method: exists? 'PUT':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
      })
      await load(); setModal({open:false, edit:null})
    } catch(e) { alert('Save failed:\n' + e.message) }
  }

  async function removeOne(p){
    if (!confirm('Delete this product?')) return
    try { await fetch(url(`/api/products/google/${encodeURIComponent(p.barcode)}`), { method:'DELETE' }); await load() }
    catch(e){ alert('Delete failed:\n' + e.message) }
  }

  return (
    <div className="space-y-6 products-page">
      <Section
        title="Products"
        actions={
          <div className="flex items-center gap-2">
            <input className="border border-line rounded-xl px-3 py-2" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
            <button className="btn-gold" onClick={addNew}>Add Product</button>
            {/* Import/Export تمت إزالتها */}
          </div>
        }
      >
        <Table columns={columns} data={filtered} />
      </Section>

      <Modal open={modal.open} onClose={()=>setModal({open:false, edit:null})} title={modal.edit? 'Edit Product' : 'Add Product'}>
        {modal.edit && (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block text-mute mb-1">Name</span>
              <input className="border border-line rounded-xl px-3 py-2 w-full" value={modal.edit.name}
                     onChange={e=>setModal(m=>({...m, edit:{...m.edit, name:e.target.value}}))}/>
            </label>
            <label className="text-sm">
              <span className="block text-mute mb-1">Barcode</span>
              <input className="border border-line rounded-xl px-3 py-2 w-full" value={modal.edit.barcode}
                     onChange={e=>setModal(m=>({...m, edit:{...m.edit, barcode:e.target.value}}))}/>
            </label>
            <label className="text-sm">
              <span className="block text-mute mb-1">Sale Price</span>
              <input type="number" className="border border-line rounded-xl px-3 py-2 w-full" value={modal.edit.salePrice}
                     onChange={e=>setModal(m=>({...m, edit:{...m.edit, salePrice:+e.target.value}}))}/>
            </label>
            <label className="text-sm">
              <span className="block text-mute mb-1">Cost</span>
              <input type="number" className="border border-line rounded-xl px-3 py-2 w-full" value={modal.edit.cost}
                     onChange={e=>setModal(m=>({...m, edit:{...m.edit, cost:+e.target.value}}))}/>
            </label>
            <label className="text-sm">
              <span className="block text-mute mb-1">Quantity</span>
              <input type="number" className="border border-line rounded-xl px-3 py-2 w-full" value={modal.edit.stock}
                     onChange={e=>setModal(m=>({...m, edit:{...m.edit, stock:+e.target.value}}))}/>
            </label>
            <label className="text-sm">
              <span className="block text-mute mb-1">Category</span>
              <input className="border border-line rounded-xl px-3 py-2 w-full" value={modal.edit.category}
                     onChange={e=>setModal(m=>({...m, edit:{...m.edit, category:e.target.value}}))}/>
            </label>
            <label className="text-sm">
              <span className="block text-mute mb-1">Unit</span>
              <input className="border border-line rounded-xl px-3 py-2 w-full" value={modal.edit.unit || ''}
                     onChange={e=>setModal(m=>({...m, edit:{...m.edit, unit:e.target.value}}))}/>
            </label>
            <label className="col-span-2 text-sm">
              <span className="block text-mute mb-1">Notes</span>
              <input className="border border-line rounded-xl px-3 py-2 w-full" value={modal.edit.notes || ''}
                     onChange={e=>setModal(m=>({...m, edit:{...m.edit, notes:e.target.value}}))}/>
            </label>
            <div className="col-span-2 flex gap-2 justify-end">
              <button className="btn-gold" onClick={()=>setModal({open:false, edit:null})}>Cancel</button>
              <button className="btn-gold" onClick={()=>save(modal.edit)}>Save</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
