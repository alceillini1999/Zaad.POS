import React from "react";

export function Button({
  children,
  onClick,
  className = "",
  type = "button",
  variant = "primary",
  size = "md",
}) {
  const base = "rounded-lg transition font-medium";
  const variants = {
    primary: "bg-green-600 hover:bg-green-700 text-white",
    outline: "border border-gray-300 hover:bg-gray-100 text-gray-700",
  };
  const sizes = { sm: "px-3 py-1 text-sm", md: "px-4 py-2 text-base" };

  return (
    <button
      type={type}
      onClick={onClick}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export default Button;
