import React from "react";

/**
 * خلفية متحركة مودرن (Dark Slate) مع لمسة Accent خفيفة.
 * تعتمد على CSS classes في index.css لتسهيل تعديل الثيم.
 */
export default function AppBackground({ children }) {
  return (
    <div className="relative min-h-screen">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-animated" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-light-sweep" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-noise" />
      {children}
    </div>
  );
}
