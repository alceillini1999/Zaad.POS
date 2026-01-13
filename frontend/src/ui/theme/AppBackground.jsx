import React from "react";

/**
 * خلفية متحركة متدرجة بألوان الشعار (Navy / Brown / Gold)
 * ثابتة خلف كل عناصر التطبيق.
 */
export default function AppBackground({ children }) {
  return (
    <div className="relative min-h-screen">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "linear-gradient(-45deg, #0A1931 0%, #1E3A8A 18%, #6B4A2B 38%, #B08946 58%, #D4AF37 78%, #F4C95D 100%)",
          backgroundSize: "300% 300%",
          animation: "brandGradient 16s ease-in-out infinite",
          filter: "saturate(1.05)",
        }}
      />
      {children}
    </div>
  );
}
