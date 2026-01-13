import React from 'react'
export default function Logo({ size = 36 }){
  return (
    <div className="grid place-items-center rounded-2xl" style={{ width:size, height:size, background:'conic-gradient(from 180deg, #D4AF37, #5A4632, #111111, #D4AF37)'}}>
      <svg width={size-14} height={size-14} viewBox="0 0 24 24" fill="#111">
        <path d="M12 2l10 18H2L12 2zm0 5L6 18h12L12 7z" fill="#111" />
        <path d="M12 7l6 11H6l6-11z" fill="#D4AF37"/>
      </svg>
    </div>
  )
}
