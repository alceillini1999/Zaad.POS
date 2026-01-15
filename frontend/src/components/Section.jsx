export default function Section({ title, actions, children }) {
  return (
    <section className="bg-white border border-line shadow-soft rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  )
}
