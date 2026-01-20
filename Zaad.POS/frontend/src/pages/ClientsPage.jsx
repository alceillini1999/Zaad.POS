import React, { useEffect, useMemo, useRef, useState } from 'react'
import Section from '../components/Section'
import Table from '../components/Table'
import Modal from '../components/Modal'

const API_ORIG = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const API_BASE = API_ORIG.replace(/\/api$/, "");
const url = (p) => `${API_BASE}${p.startsWith('/') ? p : `/${p}`}`;

async function api(p, opts={}) {
  const res = await fetch(url(p), { mode:'cors', credentials:'include', ...opts });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} @ ${url(p)}\n` + await res.text().catch(()=>"(no body)"));
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res.text();
}

export default function ClientsPage() {
  const [rows, setRows] = useState([])
  const [q, setQ]       = useState('')
  const [modal, setModal] = useState({ open:false, edit:null })

  async function load(){
    const out = await api('/api/clients');
    const list = Array.isArray(out?.data) ? out.data : (Array.isArray(out)? out : []);
    setRows(list);
  }
  useEffect(()=>{ load().catch(e=>alert(e.message)) }, [])

  const filtered = useMemo(
    ()=>rows.filter(r => (r.name || "").toLowerCase().includes(q.toLowerCase()) || (r.phone || "").includes(q)),
    [rows, q]
  )

  const columns = [
    { key: 'name',   title: 'Name' },
    { key: 'phone',  title: 'Phone' },
    { key: 'address', title: 'Address' },
    { key: 'loyaltyPoints', title: 'Points' },
    { key: '__actions', title: 'Actions', render: r => (
      <div className="flex gap-2">
        <button className="btn-gold" onClick={()=>setModal({open:true, edit:r})}>Edit</button>
        <button className="btn-gold" onClick={()=>removeOne(r)}>Delete</button>
      </div>
    )},
  ]

  function addNew(){
    setModal({ open:true, edit:{ phone:'', name:'', address:'', loyaltyPoints:0, notes:'' } })
  }

  async function save(item){
    try{
      const isEdit = rows.some(r => r.phone === item.phone);
      await api(isEdit? `/api/clients/google/${encodeURIComponent(item.phone)}` : '/api/clients/google', {
        method: isEdit? 'PUT':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(item)
      });
      await load(); setModal({open:false, edit:null});
    }catch(e){ alert('Save failed:\n' + e.message) }
  }

  async function removeOne(r){
    if (!confirm('Delete this client?')) return;
    try { await api(`/api/clients/google/${encodeURIComponent(r.phone)}`, { method:'DELETE' }); await load(); }
    catch(e){ alert('Delete failed:\n' + e.message) }
  }

  return (
    <div className="space-y-6 clients-page">
      <Section
        title="Clients"
        actions={
          <div className="flex items-center gap-2">
            <input className="border border-line rounded-xl px-3 py-2" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
            <button className="btn-gold" onClick={addNew}>Add Client</button>
            {/* Import/Export تمت إزالتها */}
          </div>
        }
      >
        <Table columns={columns} data={filtered} />
      </Section>

      <Modal open={modal.open} onClose={()=>setModal({open:false, edit:null})} title={modal.edit ? 'Edit Client' : 'Add Client'}>
        {modal.edit && (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block text-mute mb-1">Name</span>
              <input className="border border-line rounded-xl px-3 py-2 w-full" value={modal.edit.name}
                     onChange={e=>setModal(m=>({...m, edit:{...m.edit, name:e.target.value}}))}/>
            </label>
            <label className="text-sm">
              <span className="block text-mute mb-1">Phone</span>
              <input className="border border-line rounded-xl px-3 py-2 w-full" value={modal.edit.phone}
                     onChange={e=>setModal(m=>({...m, edit:{...m.edit, phone:e.target.value}}))}/>
            </label>
            <label className="text-sm col-span-2">
              <span className="block text-mute mb-1">Address</span>
              <input className="border border-line rounded-xl px-3 py-2 w-full" value={modal.edit.address || ''}
                     onChange={e=>setModal(m=>({...m, edit:{...m.edit, address:e.target.value}}))}/>
            </label>
            <label className="text-sm">
              <span className="block text-mute mb-1">Points</span>
              <input type="number" className="border border-line rounded-xl px-3 py-2 w-full" value={modal.edit.loyaltyPoints || 0}
                     onChange={e=>setModal(m=>({...m, edit:{...m.edit, loyaltyPoints:+e.target.value}}))}/>
            </label>
            <label className="text-sm col-span-2">
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
