// In-memory fallback store (no browser storage).
// The production app persists data in Google Sheets via the backend.

const DEFAULT_CLIENTS = []
let clients = [...DEFAULT_CLIENTS]

export function getClients() {
  return [...clients]
}

export function setClients(list) {
  clients = Array.isArray(list) ? [...list] : [...DEFAULT_CLIENTS]
  return getClients()
}

export function addClient(client) {
  clients = [...clients, client]
  return getClients()
}
