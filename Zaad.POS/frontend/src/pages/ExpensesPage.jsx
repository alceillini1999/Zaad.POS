import React, { useMemo, useRef, useState, useEffect } from 'react'
import Section from '../components/Section'
import Table from '../components/Table'
import Modal from '../components/Modal'

const API_ORIG = (import.meta.env.VITE_API_URL || '').replace(/\/+$/,'')
const API_BASE = API_ORIG.replace(/\/api$/,'')
const url = (p) => `${API_BASE}${p.startsWith('/') ? p : `/${p}`}`

const K = n => `KSh ${Number(n || 0).toLocaleString('en-KE')}`

function displayDate(v){
  const s = String(v||'').slice(0,10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split('-').reverse().join('/')
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s.replaceAll('-', '/')
  return s
}

export default function ExpensesPage() {
  const [rows, setRows]   = useState([])
  const [from, setFrom]   = useState('')
  const [to, setTo]       = useState('')
  const [modal, setModal] = useState({ open:false, edit:null })

  async function load(){
    const res = await fetch(url('/api/expenses'))
    const data = await res.json()
    setRows(Array.isArray(data) ? data : [])
  }
  useEffect(()=>{ load().catch(console.error) }, [])

  const filt = useMemo(()=>rows.filter(r=>{
    const d = String(r.date || '').slice(0,10)
    if (from && d < from) return false
    if (to   && d > to)   return false
    return true
  }), [rows, from, to])

  const total = useMemo(()=>filt.reduce((s,r)=>s + Number(r.amount||0), 0), [filt])

  const columns = [
    { key:'description', title:'Description' },
    { key:'date',   title:'Date', render:r=>displayDate(r.date) },
    { key:'amount', title:'Amount', render:r=>K(r.amount) },
    { key:'notes',  title:'Notes' },
  ]

  function addNew(){
    setModal({
      open: true,
      edit: { description:'', date: new Date().toISOString().slice(0,10), amount:0, category:'', notes:'' }
    })
  }

  async function save(item){
    try {
      const payload = {
        date: String(item.date||'').slice(0,10),
        description: item.description || '',
        amount: Number(item.amount || 0),
        category: item.category || '',
        notes: item.notes || '',
      }
      const res = await fetch(url('/api/expenses/google'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      await load()
      setModal({open:false, edit:null})
    } catch (e) {
      alert('Failed to save: ' + e.message)
    }
  }

  return (
    <div className="space-y-6 expenses-page">
      <Section
        title="Expenses"
        actions={
          <div className="flex gap-2">
            <input type="date" className="rounded-xl border border-line px-3 py-2" value={from} onChange={e=>setFrom(e.target.value)} />
            <input type="date" className="rounded-xl border border-line px-3 py-2" value={to}   onChange={e=>setTo(e.target.value)} />
            <button className="btn-gold" onClick={()=>{setFrom(''); setTo('')}}>Clear</button>
            <button className="btn-gold" onClick={addNew}>Add Expense</button>
            {/* Import/Export تمت إزالتها */}
          </div>
        }
      >
        <Table columns={columns} data={filt} />
        <div className="text-right mt-2 text-sm">Total: <strong>{K(total)}</strong></div>
      </Section>

      <Modal open={modal.open} onClose={()=>setModal({open:false, edit:null})} title={'Add Expense'}>
        {modal.edit && (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm col-span-2">
              <span className="block text-mute mb-1">Description</span>
              <input className="border border-line rounded-xl px-3 py-2 w-full" value={modal.edit.description}
                     onChange={e=>setModal(m=>({...m, edit:{...m.edit, description:e.target.value}}))}/>
            </label>
            <label className="text-sm">
              <span className="block text-mute mb-1">Date</span>
              <input type="date" className="border border-line rounded-xl px-3 py-2 w-full" value={modal.edit.date}
                     onChange={e=>setModal(m=>({...m, edit:{...m.edit, date:e.target.value}}))}/>
            </label>
            <label className="text-sm">
              <span className="block text-mute mb-1">Amount</span>
              <input type="number" className="border border-line rounded-xl px-3 py-2 w-full" value={modal.edit.amount}
                     onChange={e=>setModal(m=>({...m, edit:{...m.edit, amount:e.target.value}}))}/>
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
