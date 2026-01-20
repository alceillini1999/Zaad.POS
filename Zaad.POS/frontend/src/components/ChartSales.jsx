import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export default function ChartSales({ data }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.9}/>
              <stop offset="100%" stopColor="#D4AF37" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5A4632" stopOpacity={0.9}/>
              <stop offset="100%" stopColor="#5A4632" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#111111" stopOpacity={0.9}/>
              <stop offset="100%" stopColor="#111111" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAE7E1"/>
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey="sales" name="Sales" stroke="#D4AF37" fill="url(#g1)" />
          <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#5A4632" fill="url(#g2)" />
          <Area type="monotone" dataKey="net" name="Net Profit" stroke="#111111" fill="url(#g3)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
