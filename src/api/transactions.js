const BASE = import.meta.env.VITE_API_URL ?? ''

export async function deleteTransaction(id) {
  const res = await fetch(`${BASE}/api/transactions/${id}`, { method: 'DELETE' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Delete failed')
  return json
}

export async function patchTransaction(id, patch) {
  const res = await fetch(`${BASE}/api/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Update failed')
  return json
}

export async function previewDeleteRange(accountId, dateFrom, dateTo) {
  const params = new URLSearchParams({ account_id: accountId, date_from: dateFrom, date_to: dateTo })
  const res = await fetch(`${BASE}/api/transactions/range?${params}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Preview failed')
  return json  // { count }
}

export async function deleteTransactionRange(accountId, dateFrom, dateTo) {
  const params = new URLSearchParams({ account_id: accountId, date_from: dateFrom, date_to: dateTo })
  const res = await fetch(`${BASE}/api/transactions/range?${params}`, { method: 'DELETE' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Delete failed')
  return json  // { deleted }
}
