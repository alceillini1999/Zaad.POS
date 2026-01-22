// frontend/src/api/api.js
// Cookie-based API helper (no browser storage).
// The backend sets an httpOnly cookie (zaad_token) on /api/auth/login.

// Resolve API base URL consistently across the app.
// If VITE_API_URL is set (e.g. backend deployed on a different host),
// we route all relative /api calls to that host.
function resolveUrl(inputUrl) {
  const u = String(inputUrl || '');

  // Allow absolute URLs as-is.
  if (/^https?:\/\//i.test(u)) return u;

  const orig = String(import.meta?.env?.VITE_API_URL || '').replace(/\/+$/, '');
  const host = orig.replace(/\/api$/, '');
  const base = host ? `${host}/api` : '';

  // Only rewrite /api/... to the configured base.
  if (base && u.startsWith('/api/')) return `${base}${u.slice('/api'.length)}`;
  if (base && u === '/api') return base;
  return u;
}

async function api(url, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };

  // Auto JSON header if body exists and caller didn't set it
  if (options.body && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(resolveUrl(url), {
    ...options,
    headers,
    credentials: 'include',
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export default api;
