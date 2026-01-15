import React from "react";
import logo from "../assets/logo.png";

export default function Logo({ size = 56 }) {
  return (
    <div
      className="grid place-items-center rounded-2xl"
      style={{
        width: size,
        height: size,
        background:
          "conic-gradient(from 180deg, #D4AF37, #5A4632, #111111, #D4AF37)",
      }}
    >
      <img
        src={logo}
        alt="Zaad Bakery Logo"
        style={{
          width: size - 12,
          height: size - 12,
        }}
        className="object-contain"
      />
    </div>
  );
}
