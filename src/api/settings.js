import { readJson } from './http'

const BASE = import.meta.env.VITE_API_URL ?? ''

export async function downloadBackup() {
  const res = await fetch(`${BASE}/api/backup`)
  if (!res.ok) throw new Error('Backup failed')
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const filename = disposition.match(/filename="(.+)"/)?.[1] ?? `debt-city-backup-${new Date().toISOString().slice(0, 10)}.json`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function restoreBackup(backup) {
  const res = await fetch(`${BASE}/api/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true, backup }),
  })
  return readJson(res, 'Restore failed')
}
