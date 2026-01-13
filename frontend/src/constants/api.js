const raw = import.meta.env?.VITE_API_URL ?? "https://zaad-bakery.onrender.com/api";
export const API_URL = (raw || "").replace(/\/$/, "");