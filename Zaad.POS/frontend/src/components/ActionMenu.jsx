import React, { useEffect, useRef, useState } from 'react'

export default function ActionMenu({ label = 'Menu', options = [] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button className="btn" onClick={()=>setOpen(o=>!o)}>{label}</button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-white border border-line rounded-xl shadow-soft z-10">
          {options.map((opt, idx) => (
            <button
              key={idx}
              className="w-full text-left px-3 py-2 hover:bg-base"
              onClick={() => { setOpen(false); opt.onClick?.() }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
