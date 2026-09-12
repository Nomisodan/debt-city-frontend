import { readJson } from './http'

const BASE = import.meta.env.VITE_API_URL ?? ''

export async function deleteTransaction(id) {
  const res = await fetch(`${BASE}/api/transactions/${id}`, { method: 'DELETE' })
  return readJson(res, 'Delete failed')
}

export async function patchTransaction(id, patch) {
  const res = await fetch(`${BASE}/api/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return readJson(res, 'Update failed')
}

export async function previewDeleteRange(accountId, dateFrom, dateTo) {
  const params = new URLSearchParams({ account_id: accountId, date_from: dateFrom, date_to: dateTo })
  const res = await fetch(`${BASE}/api/transactions/range?${params}`)
  return readJson(res, 'Preview failed')  // { count }
}

export async function deleteTransactionRange(accountId, dateFrom, dateTo) {
  const params = new URLSearchParams({ account_id: accountId, date_from: dateFrom, date_to: dateTo })
  const res = await fetch(`${BASE}/api/transactions/range?${params}`, { method: 'DELETE' })
  return readJson(res, 'Delete failed')  // { deleted }
}
