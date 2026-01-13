export default function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-soft w-full max-w-xl">
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="btn">Close</button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="p-4 border-t border-line">{footer}</div>}
      </div>
    </div>
  )
}
