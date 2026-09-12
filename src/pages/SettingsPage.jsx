import { useState } from 'react'
import { downloadBackup, restoreBackup } from '../api/settings'

const RESTORE_PHRASE = 'RESTORE'

function BackupSection() {
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(null)

  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [confirmText, setConfirmText] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState(null)
  const [restoreDone, setRestoreDone] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    setDownloadError(null)
    try {
      await downloadBackup()
    } catch (err) {
      setDownloadError(err.message)
    } finally {
      setDownloading(false)
    }
  }

  async function handleFileChange(e) {
    const f = e.target.files?.[0]
    setFile(f ?? null)
    setParsed(null)
    setRestoreError(null)
    if (!f) return
    try {
      const text = await f.text()
      const json = JSON.parse(text)
      if (!json?.tables) throw new Error('not a valid backup file')
      setParsed(json)
    } catch {
      setRestoreError('Could not read that file as a debt city backup.')
    }
  }

  async function handleRestore() {
    setRestoring(true)
    setRestoreError(null)
    try {
      await restoreBackup(parsed)
      setRestoreDone(true)
      setTimeout(() => window.location.reload(), 1200)
    } catch (err) {
      setRestoreError(err.message)
      setRestoring(false)
    }
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 mb-4">
      <p className="text-sm font-semibold text-[var(--color-text)] mb-1">Backup</p>
      <p className="text-xs text-[var(--color-muted)] mb-3">
        Download a full copy of every account, transaction, and debt allocation. Keep it somewhere safe
        so you can restore to this exact point if a change goes wrong.
      </p>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="w-full py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold text-sm disabled:opacity-40 mb-1"
      >
        {downloading ? 'Preparing…' : 'Download backup'}
      </button>
      {downloadError && <p className="text-xs text-[var(--color-expense)] mt-2">{downloadError}</p>}

      <div className="border-t border-[var(--color-border)] mt-4 pt-4">
        <p className="text-xs text-[var(--color-muted)] mb-3">
          Restoring replaces everything currently in the app with the contents of the file below.
        </p>

        {restoreDone ? (
          <p className="text-sm text-[var(--color-income)]">Restored. Reloading…</p>
        ) : (
          <>
            <input
              type="file"
              accept="application/json"
              onChange={handleFileChange}
              className="w-full text-xs text-[var(--color-muted)] mb-3 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-surface-2)] file:text-[var(--color-text)]"
            />
            {parsed && (
              <>
                <label className="text-xs text-[var(--color-muted)] mb-1.5 block">
                  Type <span className="font-mono font-semibold text-[var(--color-text)]">{RESTORE_PHRASE}</span> to confirm
                </label>
                <input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={RESTORE_PHRASE}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-expense)] mb-3"
                />
                <button
                  onClick={handleRestore}
                  disabled={confirmText !== RESTORE_PHRASE || restoring}
                  className="w-full py-2.5 rounded-xl bg-[var(--color-expense)] text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {restoring ? 'Restoring…' : `Restore from ${file?.name ?? 'file'}`}
                </button>
              </>
            )}
            {restoreError && <p className="text-xs text-[var(--color-expense)] mt-2">{restoreError}</p>}
          </>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 max-w-lg mx-auto pb-24">
      <h1 className="text-lg font-bold text-[var(--color-text)] mb-1">Settings</h1>
      <p className="text-xs text-[var(--color-muted)] mb-6">Manage app-wide data and preferences.</p>

      <BackupSection />
    </div>
  )
}
