// Simple localStorage helpers for demo persistence

const KEY = 'pm_clients_data_v1';

// Default seed (can be overridden by imported pages)
export const DEFAULT_CLIENTS = [
  { id: 1, name: 'Mohamed Adel', phone: '+254700000001', orders: 12, lastOrder: '2025-02-01', points: 120 },
  { id: 2, name: 'Sara Nabil',  phone: '+254700000002', orders: 4,  lastOrder: '2025-02-03', points: 30 },
  { id: 3, name: 'Omar Ali',     phone: '+254700000003', orders: 20, lastOrder: '2025-02-04', points: 220 },
];

export function loadClients() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(DEFAULT_CLIENTS));
      return [...DEFAULT_CLIENTS];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    localStorage.setItem(KEY, JSON.stringify(DEFAULT_CLIENTS));
    return [...DEFAULT_CLIENTS];
  }
}

export function saveClients(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

// Update helpers from POS:
export function applyPurchaseToClient(clientId, { points = 0, date = new Date().toISOString().slice(0,10) }) {
  const list = loadClients();
  const idx = list.findIndex(c => c.id === clientId);
  if (idx >= 0) {
    const c = { ...list[idx] };
    c.points = Math.max(0, (c.points || 0) + points);
    c.orders = (c.orders || 0) + 1;
    c.lastOrder = date;
    list[idx] = c;
    saveClients(list);
    return c;
  }
  return null;
}
