import React from "react";

export default function AnimatedFooter() {
  return (
    <footer className="pm-footer">
      <div className="pm-footer-inner">
        <span className="pm-line" aria-hidden />
        <div className="pm-brand">
          © 2025 Zaad Bakery — Developed and owned by Ahmed Ali
        </div>
        <span className="pm-line" aria-hidden />
      </div>
      <div className="pm-footer-inner" style={{paddingTop: 0}}>
        <span className="pm-line thin" aria-hidden />
        <span style={{width: 220}} />
        <span className="pm-line thin" aria-hidden />
      </div>
    </footer>
  );
}
