const BASE = import.meta.env.VITE_API_URL ?? ''

export async function uploadCsv(accountId, file) {
  const body = new FormData()
  body.append('account_id', accountId)
  body.append('file', file)

  const res = await fetch(`${BASE}/api/upload`, { method: 'POST', body })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Upload failed')
  return data
}
