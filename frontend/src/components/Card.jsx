import React from 'react'
export default function Card({ title, value, footer, icon }){
  return (
    <div className="bg-white border border-line shadow-soft rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-mute">{title}</div>
          <div className="text-2xl font-semibold text-ink mt-1">{value}</div>
        </div>
        {icon}
      </div>
      {footer && <div className="mt-4 text-sm text-mute">{footer}</div>}
    </div>
  )
}
