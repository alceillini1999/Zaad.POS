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
          "conic-gradient(from 180deg, #FBBF24, #F59E0B, #0F172A, #FBBF24)",
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
