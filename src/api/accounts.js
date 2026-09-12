import { readJson } from './http'

const BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchAccounts() {
  const res = await fetch(`${BASE}/api/accounts`)
  return readJson(res, 'Failed to fetch accounts')
}

export async function createAccount(data) {
  const res = await fetch(`${BASE}/api/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return readJson(res, 'Create failed')
}

export async function updateAccount(id, patch) {
  const res = await fetch(`${BASE}/api/accounts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return readJson(res, 'Update failed')
}

export async function deleteAccount(id) {
  const res = await fetch(`${BASE}/api/accounts/${id}`, { method: 'DELETE' })
  return readJson(res, 'Delete failed')
}
