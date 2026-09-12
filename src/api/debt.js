const BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchDebt() {
  const res = await fetch(`${BASE}/api/debt`)
  if (!res.ok) throw new Error('Failed to fetch debt data')
  return res.json()
}

export async function applyDebtPayment(allocations, paymentIds = []) {
  const res = await fetch(`${BASE}/api/debt/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ allocations, payment_ids: paymentIds }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Payment failed')
  return data
}

export async function dismissDebtPayment(paymentId) {
  return applyDebtPayment([], [paymentId])
}

export async function undismissDebtPayment(paymentId) {
  const res = await fetch(`${BASE}/api/debt/payments/${paymentId}/undismiss`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Restore failed')
  return data
}

export async function updateDebtLink(linkId, amount) {
  const res = await fetch(`${BASE}/api/debt/links/${linkId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Update failed')
  return data
}

export async function deleteDebtLink(linkId) {
  const res = await fetch(`${BASE}/api/debt/links/${linkId}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Delete failed')
  return data
}

export async function resetDebtPayments(accountId = null) {
  const res = await fetch(`${BASE}/api/debt/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(accountId ? { account_id: accountId } : {}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Reset failed')
  return data
}
