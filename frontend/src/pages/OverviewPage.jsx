import React, { useEffect, useMemo, useState } from 'react'
import Section from '../components/Section'
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, AreaChart, Area
} from 'recharts'

const API_ORIG = (import.meta.env.VITE_API_URL || "").replace(/\/+$/,"");
const API_BASE = API_ORIG.replace(/\/api$/,"");
const url = (p) => `${API_BASE}${p.startsWith('/') ? p : `/${p}`}`;

const K = n => `KSh ${Number(n||0).toLocaleString('en-KE',{maximumFractionDigits:2})}`

// helpers
const startOfDay = d => { const x=new Date(d); x.setHours(0,0,0,0); return x }
const endOfDay   = d => { const x=new Date(d); x.setHours(23,59,59,999); return x }
const sameDay = (a,b) => startOfDay(a).getTime() === startOfDay(b).getTime()
const fmtD = d => new Date(d).toISOString().slice(0,10)

export default function OverviewPage() {
  const today = new Date().toISOString().slice(0,10)
  const [fromDate, setFromDate] = useState(today)
  const [toDate,   setToDate]   = useState(today)

  const [sales, setSales] = useState([])
  const [expenses, setExpenses] = useState([])

  useEffect(()=>{(async()=>{
    try{
      const s = await (await fetch(url('/api/sales?page=1&limit=2000'), { credentials:'include' })).json()
      const sRows = Array.isArray(s) ? s : (Array.isArray(s.rows)? s.rows : [])
      setSales(sRows)
      const e = await (await fetch(url('/api/expenses'), { credentials:'include' })).json()
      setExpenses(Array.isArray(e) ? e : [])
    }catch(e){ console.error(e) }
  })()},[])

  const dFrom = useMemo(()=>startOfDay(new Date(fromDate)),[fromDate])
  const dTo   = useMemo(()=>endOfDay(new Date(toDate)),[toDate])
  const oneDay = useMemo(()=> sameDay(dFrom, dTo), [dFrom,dTo])

  // totals
  const totals = useMemo(()=>{
    const inRange = (t)=>{ const d=new Date(t); return d>=dFrom && d<=dTo }
    const ts = sales.filter(s=>inRange(s.createdAt)).reduce((s,r)=>s + Number(r.total||0),0)
    const te = expenses.filter(e=>inRange(e.date)).reduce((s,r)=>s + Number(r.amount||0),0)
    return { totalSales: ts, totalExpenses: te, netProfit: ts - te }
  },[sales, expenses, dFrom, dTo])

  // dataset
  const chartData = useMemo(()=>{
    const inRange = (t)=>{ const d=new Date(t); return d>=dFrom && d<=dTo }
    if (oneDay) {
      // بالساعات
      const bS = Array(24).fill(0), bE = Array(24).fill(0)
      sales.forEach(s=>{ if(inRange(s.createdAt)){ const h=new Date(s.createdAt).getHours(); bS[h]+=Number(s.total||0) }})
      expenses.forEach(e=>{ if(inRange(e.date)){ const h=(new Date(e.date).getHours?.() ?? 0); bE[h]+=Number(e.amount||0) }})
      return Array.from({length:24}).map((_,h)=>({ label:`${h}:00`, sales:bS[h], expenses:bE[h], net:bS[h]-bE[h] }))
    }
    // بالأيام
    const days = []
    for (let d = startOfDay(dFrom); d <= dTo; d = new Date(d.getTime()+86400000)) days.push(fmtD(d))
    const mapS = Object.create(null), mapE = Object.create(null)
    days.forEach(d=>{ mapS[d]=0; mapE[d]=0 })
    sales.forEach(s=>{ const d=fmtD(s.createdAt); if (d in mapS) mapS[d]+=Number(s.total||0) })
    expenses.forEach(e=>{ const d=fmtD(e.date);     if (d in mapE) mapE[d]+=Number(e.amount||0) })
    return days.map(d=>({ label:d, sales:mapS[d], expenses:mapE[d], net:mapS[d]-mapE[d] }))
  },[sales, expenses, dFrom, dTo, oneDay])

  return (
    <div className="page-surface overview-page">
      {/* شريط نطاق التاريخ */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="text-white/80">From</label>
        <input type="date" className="rounded-xl bg-white/90 text-black px-3 py-2"
               value={fromDate} max={toDate} onChange={e=>setFromDate(e.target.value)} />
        <label className="text-white/80">To</label>
        <input type="date" className="rounded-xl bg-white/90 text-black px-3 py-2"
               value={toDate} min={fromDate} onChange={e=>setToDate(e.target.value)} />
      </div>

      {/* الكروت */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-6">
        <div className="rounded-2xl p-4 bg-transparent border border-white/10 backdrop-blur">
          <div className="text-white/70 mb-1">Total Sales</div>
          <div className="text-3xl font-semibold">{K(totals.totalSales)}</div>
        </div>
        <div className="rounded-2xl p-4 bg-transparent border border-white/10 backdrop-blur">
          <div className="text-white/70 mb-1">Expenses</div>
          <div className="text-3xl font-semibold">{K(totals.totalExpenses)}</div>
        </div>
        <div className="rounded-2xl p-4 bg-transparent border border-white/10 backdrop-blur">
          <div className="text-white/70 mb-1">Net Profit</div>
          <div className="text-3xl font-semibold">{K(totals.netProfit)}</div>
        </div>
      </div>

      {/* الرسم */}
      <Section title={oneDay ? "Hourly — Sales vs Expenses vs Net" : "Daily — Sales vs Expenses vs Net"}>
        <div style={{ width:'100%', height: 360 }}>
          <ResponsiveContainer>
            {oneDay ? (
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.22)" strokeDasharray="4 4" />
                <XAxis dataKey="label" stroke="#ffffff" tick={{ fill:'#ffffff' }} tickMargin={8}/>
                <YAxis stroke="#ffffff" tick={{ fill:'#ffffff' }} tickMargin={8}/>
                <Tooltip contentStyle={{ background:'rgba(0,0,0,0.7)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff' }}
                         labelStyle={{ color:'#fff' }} />
                <Legend wrapperStyle={{ color:'#fff' }} />
                <Line type="monotone" dataKey="sales"    name="Sales"      stroke="#F4C95D" strokeWidth={3} dot={false}/>
                <Line type="monotone" dataKey="expenses" name="Expenses"   stroke="#B08946" strokeWidth={3} dot={false}/>
                <Line type="monotone" dataKey="net"      name="Net Profit" stroke="#FFFFFF" strokeWidth={3} dot={false}/>
              </LineChart>
            ) : (
              <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.22)" strokeDasharray="4 4" />
                <XAxis dataKey="label" stroke="#ffffff" tick={{ fill:'#ffffff' }} tickMargin={8}/>
                <YAxis stroke="#ffffff" tick={{ fill:'#ffffff' }} tickMargin={8}/>
                <Tooltip contentStyle={{ background:'rgba(0,0,0,0.7)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff' }}
                         labelStyle={{ color:'#fff' }} />
                <Legend wrapperStyle={{ color:'#fff' }} />
                <Area type="monotone" dataKey="sales"    name="Sales"      stroke="#F4C95D" fill="rgba(244,201,93,.25)"  strokeWidth={3}/>
                <Area type="monotone" dataKey="expenses" name="Expenses"   stroke="#B08946" fill="rgba(176,137,70,.22)" strokeWidth={3}/>
                <Area type="monotone" dataKey="net"      name="Net Profit" stroke="#FFFFFF" fill="rgba(255,255,255,.18)" strokeWidth={3}/>
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </Section>
    </div>
  )
}
