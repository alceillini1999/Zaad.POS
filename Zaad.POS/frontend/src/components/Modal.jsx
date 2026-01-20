import React from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function Modal({ open, title, onClose, children, footer }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.16 }}
          >
            <div
              className="ui-card w-full max-w-2xl overflow-hidden"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start justify-between gap-3 p-4 border-b border-line">
                <div className="min-w-0">
                  <div className="ui-h2">{title}</div>
                </div>
                <button onClick={onClose} className="ui-btn ui-btn-ghost">
                  Close
                </button>
              </div>

              <div className="p-4">{children}</div>

              {footer && <div className="p-4 border-t border-line">{footer}</div>}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
