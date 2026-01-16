import React from "react";

/**
 * Card (Redesign)
 * - يستخدم للكروت الإحصائية أو المحتوى.
 */
export default function Card({
  title,
  value,
  subtitle,
  icon,
  meta,
  className = "",
  children,
}) {
  return (
    <div className={`ui-card p-4 md:p-5 ${className}`}>
      {(title || icon || value || subtitle || meta) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <div className="text-xs font-bold uppercase tracking-wider text-mute">{title}</div>}
            {value != null && (
              <div className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
                {value}
              </div>
            )}
            {subtitle && <div className="mt-1 text-sm text-mute">{subtitle}</div>}
            {meta && <div className="mt-3">{meta}</div>}
          </div>
          {icon && (
            <div className="shrink-0">
              <div className="h-11 w-11 rounded-2xl bg-base border border-line flex items-center justify-center text-ink/70">
                {icon}
              </div>
            </div>
          )}
        </div>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
