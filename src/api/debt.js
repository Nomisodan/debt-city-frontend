import { readJson } from './http'

const BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchDebt() {
  const res = await fetch(`${BASE}/api/debt`)
  return readJson(res, 'Failed to fetch debt data')
}

export async function applyDebtPayment(allocations, paymentIds = []) {
  const res = await fetch(`${BASE}/api/debt/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ allocations, payment_ids: paymentIds }),
  })
  return readJson(res, 'Payment failed')
}

export async function dismissDebtPayment(paymentId) {
  return applyDebtPayment([], [paymentId])
}

export async function undismissDebtPayment(paymentId) {
  const res = await fetch(`${BASE}/api/debt/payments/${paymentId}/undismiss`, { method: 'POST' })
  return readJson(res, 'Restore failed')
}

export async function updateDebtLink(linkId, amount) {
  const res = await fetch(`${BASE}/api/debt/links/${linkId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  })
  return readJson(res, 'Update failed')
}

export async function deleteDebtLink(linkId) {
  const res = await fetch(`${BASE}/api/debt/links/${linkId}`, { method: 'DELETE' })
  return readJson(res, 'Delete failed')
}

export async function resetDebtPayments(accountId = null) {
  const res = await fetch(`${BASE}/api/debt/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(accountId ? { account_id: accountId } : {}),
  })
  return readJson(res, 'Reset failed')
}
