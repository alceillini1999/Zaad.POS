import React from 'react'
export default function Card({ title, value, footer, icon }){
  return (
    <div className="bg-elev p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="card-title">{title}</div>
          <div className="card-value mt-1">{value}</div>
        </div>
        {icon}
      </div>
      {footer && <div className="mt-4 text-sm text-mute">{footer}</div>}
    </div>
  )
}
