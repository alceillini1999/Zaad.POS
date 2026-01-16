export default function Section({
  title,
  subtitle,
  actions,
  children,
  className = "",
  bodyClassName = "",
}) {
  return (
    <section className={`ui-panel mb-6 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            {title && <h2 className="ui-h2">{title}</h2>}
            {subtitle && <div className="ui-sub mt-0.5">{subtitle}</div>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
