// frontend/src/api/api.js
// Cookie-based API helper (no browser storage).
// The backend sets an httpOnly cookie (zaad_token) on /api/auth/login.

async function api(url, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };

  // Auto JSON header if body exists and caller didn't set it
  if (options.body && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
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
