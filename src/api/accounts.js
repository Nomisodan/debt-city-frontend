const BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchAccounts() {
  const res = await fetch(`${BASE}/api/accounts`)
  if (!res.ok) throw new Error('Failed to fetch accounts')
  return res.json()
}

export async function createAccount(data) {
  const res = await fetch(`${BASE}/api/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Create failed')
  return json
}

export async function updateAccount(id, patch) {
  const res = await fetch(`${BASE}/api/accounts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Update failed')
  return data
}

export async function deleteAccount(id) {
  const res = await fetch(`${BASE}/api/accounts/${id}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Delete failed')
  return data
}
