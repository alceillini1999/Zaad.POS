export const API_BASE = (import.meta.env.VITE_API_URL || "")
  .replace(/\/+$/, "")     // يشيل أي / في النهاية
  .replace(/\/api$/i, ""); // يشيل /api لو موجودة في النهاية

export function apiUrl(p) {
  const base = API_BASE || "";
  const path = p.startsWith("/") ? p : `/${p}`;
  return `${base}${path}`;
}
