import { useState, useEffect, useMemo } from 'react'
import { fetchDebt, applyDebtPayment, dismissDebtPayment, resetDebtPayments, updateDebtLink, deleteDebtLink, undismissDebtPayment } from '../api/debt'
import { updateAccount } from '../api/accounts'
import { deleteTransaction, patchTransaction } from '../api/transactions'

const BANK_LABEL = {
  bmo: 'BMO', scotiabank: 'Scotiabank', capital_one: 'Capital One',
  loc: 'LOC', desjardins: 'Desjardins', other: 'Other',
}

function fmt(n) {
  return '$' + Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function r2(n) {
  return Math.round(n * 100) / 100
}

function monthLabel(mk) {
  const [y, m] = mk.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
}

function shortDate(dateStr) {
  return new Date(dateStr + 'T00:00:00')
    .toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

function dateWithYear(dateStr) {
  return new Date(dateStr + 'T00:00:00')
    .toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Month Navigator ──────────────────────────────────────────────────────────

function MonthNav({ months, selected, onSelect }) {
  const idx     = months.indexOf(selected)
  const hasPrev = idx < months.length - 1   // older
  const hasNext = idx > 0                    // newer

  return (
    <div className="flex items-center justify-between mb-6">
      <button
        onClick={() => hasPrev && onSelect(months[idx + 1])}
        disabled={!hasPrev}
        className="w-10 h-10 flex items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] disabled:opacity-25 hover:text-[var(--color-text)] hover:border-[var(--color-muted)] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>

      <div className="text-center flex-1 mx-3">
        <p className="text-lg font-bold text-[var(--color-text)]">{monthLabel(selected)}</p>
        <p className="text-[10px] text-[var(--color-muted)] mt-0.5">
          {months.length} statement month{months.length !== 1 ? 's' : ''}
        </p>
      </div>

      <button
        onClick={() => hasNext && onSelect(months[idx - 1])}
        disabled={!hasNext}
        className="w-10 h-10 flex items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] disabled:opacity-25 hover:text-[var(--color-text)] hover:border-[var(--color-muted)] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>
  )
}

// ─── Payment Calculation Drawer ───────────────────────────────────────────────

function groupByMonth(items) {
  const map = {}
  for (const item of items) {
    const mk = item.date.slice(0, 7)
    if (!map[mk]) map[mk] = []
    map[mk].push(item)
  }
  return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
}

function ChargeRow({ item, alloc, locked, leftover, onToggle, subtitle, danger }) {
  const isSelected = !!alloc
  const isCovered  = alloc?.fullyCovered
  const isPartial  = isSelected && !isCovered
  const canTap     = !locked && (isSelected || leftover > 0)

  return (
    <button
      onClick={() => !locked && onToggle(item)}
      disabled={locked || (!isSelected && leftover <= 0)}
      className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl border transition-all ${
        isCovered   ? 'border-[var(--color-income)]/50 bg-[var(--color-income)]/10'
        : isPartial ? 'border-[var(--color-today)]/50 bg-[var(--color-today)]/10'
        : danger    ? `border-[var(--color-expense)]/40 bg-[var(--color-expense)]/5 ${canTap ? 'active:opacity-70' : 'opacity-30'}`
        : canTap    ? 'border-[var(--color-border)] bg-[var(--color-bg)] active:opacity-70'
        :             'border-[var(--color-border)] bg-[var(--color-bg)] opacity-30'
      }`}
    >
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
        isCovered   ? 'border-[var(--color-income)] bg-[var(--color-income)]'
        : isPartial ? 'border-[var(--color-today)] bg-[var(--color-today)]'
        : danger    ? 'border-[var(--color-expense)]'
        :             'border-[var(--color-border)]'
      }`}>
        {isSelected && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${
          isCovered ? 'line-through text-[var(--color-income)]' : danger ? 'text-[var(--color-expense)]' : 'text-[var(--color-text)]'
        }`}>
          {item.description}
        </p>
        <p className="text-[10px] text-[var(--color-muted)]">{subtitle}</p>
      </div>

      <div className="text-right flex-shrink-0 min-w-[72px]">
        {isCovered ? (
          <p className="text-sm font-mono font-semibold text-[var(--color-income)]">{fmt(alloc.allocated)}</p>
        ) : isPartial ? (
          <div>
            <p className="text-xs font-mono text-[var(--color-today)] leading-tight">{fmt(alloc.allocated)} now</p>
            <p className="text-[10px] font-mono text-[var(--color-expense)] leading-tight">{fmt(item.remaining - alloc.allocated)} left</p>
          </div>
        ) : (
          <p className="text-sm font-mono font-semibold text-[var(--color-expense)]">{fmt(item.remaining)}</p>
        )}
      </div>
    </button>
  )
}

function ArchivedBalanceRow({ item, alloc, locked, leftover, onToggle }) {
  const [expanded, setExpanded] = useState(false)
  const history = item.history || []

  return (
    <div className="mt-1 pt-2 border-t border-[var(--color-border)]/50">
      <ChargeRow
        item={item}
        alloc={alloc}
        locked={locked}
        leftover={leftover}
        onToggle={onToggle}
        danger
        subtitle={
          <>
            Collapsed total, not itemized above
            {item.paid_amount > 0 && (
              <span className="ml-1 text-[var(--color-today)]">· {fmt(item.paid_amount)} already paid</span>
            )}
          </>
        }
      />

      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full mt-1 px-3 py-1.5 flex items-center justify-between text-[10px] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        <span>{expanded ? 'Hide' : 'Show'} how this total was calculated</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-1">
          <div className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/40">
            <p className="text-[11px] text-[var(--color-muted)]">
              Before balance{item.anchor_date && ` (${shortDate(item.anchor_date)})`}
            </p>
            <p className="text-xs font-mono text-[var(--color-text)]">
              {item.anchor_balance < 0 ? '-' : ''}{fmt(item.anchor_balance)}
            </p>
          </div>
          {history.map(t => (
            <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/40 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[var(--color-text)] truncate">{t.description}</p>
                <p className="text-[10px] text-[var(--color-muted)]">{shortDate(t.date)}</p>
              </div>
              <p className={`text-xs font-mono ${t.amount < 0 ? 'text-[var(--color-expense)]' : 'text-[var(--color-income)]'}`}>
                {t.amount < 0 ? '-' : '+'}{fmt(t.amount)}
              </p>
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-[10px] text-[var(--color-muted)] py-1.5">No transactions between the before balance and this cutoff — the total is the before balance itself.</p>
          )}
          <div className="flex items-center justify-between pt-1.5 mt-0.5 border-t border-[var(--color-border)]">
            <p className="text-[11px] font-semibold text-[var(--color-text)]">Outstanding balance</p>
            <p className="text-xs font-mono font-semibold text-[var(--color-expense)]">-{fmt(item.amount)}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function PaymentDrawer({ account, onClose, onReset }) {
  const unpaidItems    = account.items.filter(i => !i.is_paid)
  const archivedItem   = account.archived_item || null
  const deductibleItems = archivedItem ? [archivedItem, ...unpaidItems] : unpaidItems
  const allPayments    = account.payments || []

  const [selectedPaymentIds, setSelectedPaymentIds] = useState([])
  const [paymentInput, setPaymentInput]           = useState('')
  const [editingAmount, setEditingAmount]         = useState(true)
  const [selectedIds, setSelectedIds]             = useState([])
  const [applying, setApplying]                   = useState(false)
  const [error, setError]                         = useState(null)
  const [confirmReset, setConfirmReset]           = useState(false)
  const [resetting, setResetting]                 = useState(false)
  const [dismissingId, setDismissingId]           = useState(null)

  async function dismissPayment(p) {
    setDismissingId(p.id)
    setError(null)
    try {
      await dismissDebtPayment(p.id)
      onReset(account.id)
      if (selectedPaymentIds.includes(p.id)) clearPaymentSource()
    } catch (e) {
      setError(e.message)
    } finally {
      setDismissingId(null)
    }
  }

  async function doReset() {
    setResetting(true)
    try {
      await resetDebtPayments(account.id)
      onReset(account.id)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setResetting(false)
    }
  }

  const paymentTotal   = parseFloat(paymentInput) || 0

  function computeAllocs(ids, total) {
    let rem = total
    return ids.map(id => {
      const item = deductibleItems.find(i => i.id === id)
      if (!item) return null
      const allocated = r2(Math.min(rem, item.remaining))
      rem = r2(rem - allocated)
      return { id, allocated, itemRemaining: item.remaining, fullyCovered: allocated >= item.remaining - 0.005 }
    }).filter(Boolean)
  }

  const allocations    = computeAllocs(selectedIds, paymentTotal)
  const allocMap       = Object.fromEntries(allocations.map(a => [a.id, a]))
  const allocatedTotal = r2(allocations.reduce((s, a) => s + a.allocated, 0))
  const leftover       = r2(paymentTotal - allocatedTotal)
  const usedPct        = paymentTotal > 0 ? Math.min(100, (allocatedTotal / paymentTotal) * 100) : 0

  function togglePayment(p) {
    setSelectedPaymentIds(prev => {
      const next = prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
      const sum = next.reduce((s, id) => s + (allPayments.find(x => x.id === id)?.amount ?? 0), 0)
      setPaymentInput(next.length === 0 ? '' : r2(sum).toString())
      setEditingAmount(next.length === 0)
      return next
    })
    setSelectedIds([])   // reset charge selection when payment sources change
  }

  function clearPaymentSource() {
    setSelectedPaymentIds([])
    setEditingAmount(true)
    setSelectedIds([])
  }

  function toggleItem(item) {
    if (selectedIds.includes(item.id)) {
      setSelectedIds(prev => prev.filter(id => id !== item.id))
    } else {
      if (paymentTotal <= 0 || leftover <= 0) return
      setSelectedIds(prev => [...prev, item.id])
    }
  }

  async function apply() {
    const toApply = allocations.filter(a => a.allocated > 0).map(a => ({ id: a.id, amount: a.allocated }))
    if (!toApply.length) return
    setApplying(true)
    setError(null)
    try {
      await applyDebtPayment(toApply, selectedPaymentIds)
      onReset(account.id)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-[var(--color-surface)] rounded-t-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
        </div>

        {/* Header */}
        <div className="px-4 pt-1 pb-3 flex items-start justify-between flex-shrink-0">
          <div>
            <p className="text-base font-bold text-[var(--color-text)]">Make a Payment</p>
            <p className="text-xs text-[var(--color-muted)]">{account.name} · {BANK_LABEL[account.bank] ?? account.bank}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors rounded-lg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Balance hero ── */}
        <div className="px-4 pb-4 flex-shrink-0 border-b border-[var(--color-border)]">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest mb-1">
                {paymentTotal > 0 && !editingAmount ? 'Remaining to allocate' : 'Payment amount'}
              </p>

              {editingAmount ? (
                <div className="relative">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-3xl font-mono font-bold text-[var(--color-muted)] pointer-events-none">$</span>
                  <input
                    type="number" step="0.01" min="0"
                    value={paymentInput}
                    onChange={e => { setPaymentInput(e.target.value); setSelectedPaymentIds([]) }}
                    onBlur={() => { if (paymentTotal > 0) setEditingAmount(false) }}
                    onKeyDown={e => { if (e.key === 'Enter' && paymentTotal > 0) setEditingAmount(false) }}
                    autoFocus
                    placeholder="0.00"
                    className="pl-7 bg-transparent border-none outline-none text-3xl font-mono font-bold text-[var(--color-text)] w-48 placeholder:text-[var(--color-border)]"
                  />
                </div>
              ) : (
                <button onClick={clearPaymentSource} className="text-left group">
                  <span className={`text-4xl font-mono font-bold transition-colors ${
                    leftover === 0  ? 'text-[var(--color-income)]'
                    : leftover < 0 ? 'text-[var(--color-expense)]'
                    :                'text-[var(--color-today)]'
                  }`}>
                    {fmt(leftover)}
                  </span>
                  <span className="ml-2 text-xs text-[var(--color-muted)] group-hover:text-[var(--color-text)] transition-colors">
                    of {fmt(paymentTotal)}
                  </span>
                </button>
              )}
            </div>

            {paymentTotal > 0 && !editingAmount && (
              <div className="text-right">
                <p className="text-[10px] text-[var(--color-muted)]">used</p>
                <p className="text-xl font-mono font-bold text-[var(--color-text)]">{fmt(allocatedTotal)}</p>
              </div>
            )}
          </div>

          {paymentTotal > 0 && !editingAmount && (
            <>
              <div className="h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${usedPct >= 100 ? 'bg-[var(--color-income)]' : 'bg-[var(--color-today)]'}`}
                  style={{ width: `${usedPct}%` }}
                />
              </div>
              {leftover === 0 && (
                <p className="text-xs text-[var(--color-income)] mt-1.5">Payment fully allocated!</p>
              )}
            </>
          )}
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-3 pb-4 flex flex-col gap-5">

            {/* ── Payments received ── */}
            {allPayments.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest mb-2">
                  Payments received
                </p>
                <div className="flex flex-col gap-1.5">
                  {allPayments.map(p => {
                    const isActive = selectedPaymentIds.includes(p.id)
                    const isDismissing = dismissingId === p.id
                    return (
                      <div
                        key={p.id}
                        role="button" tabIndex={0}
                        onClick={() => togglePayment(p)}
                        onKeyDown={e => { if (e.key === 'Enter') togglePayment(p) }}
                        className={`w-full flex items-center justify-between px-3 py-3 rounded-xl border transition-all cursor-pointer ${
                          isActive
                            ? 'border-[var(--color-income)] bg-[var(--color-income)]/10'
                            : 'border-[var(--color-border)] bg-[var(--color-bg)] active:opacity-70'
                        }`}
                      >
                        <div className="min-w-0 flex-1 text-left">
                          <p className="text-sm font-medium text-[var(--color-text)] truncate">{p.description}</p>
                          <p className="text-[10px] text-[var(--color-muted)]">
                            {shortDate(p.date)}
                            <button
                              onClick={e => { e.stopPropagation(); dismissPayment(p) }}
                              disabled={isDismissing}
                              className="ml-2 text-[var(--color-muted)] underline decoration-dotted hover:text-[var(--color-expense)] disabled:opacity-50"
                            >
                              {isDismissing ? 'dismissing…' : 'already counted, dismiss'}
                            </button>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                          <p className="text-base font-mono font-bold text-[var(--color-income)]">{fmt(p.amount)}</p>
                          {isActive ? (
                            <div className="w-5 h-5 rounded bg-[var(--color-income)] flex items-center justify-center">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded border-2 border-[var(--color-border)]" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {selectedPaymentIds.length > 1 && (
                  <p className="text-[10px] text-[var(--color-today)] mt-1.5">
                    {selectedPaymentIds.length} payments combined · {fmt(paymentTotal)}
                  </p>
                )}

                {/* Manual amount option */}
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex-1 h-px bg-[var(--color-border)]" />
                  <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-widest">or enter manually</span>
                  <div className="flex-1 h-px bg-[var(--color-border)]" />
                </div>
                <button
                  onClick={clearPaymentSource}
                  className={`mt-2 w-full px-3 py-2 rounded-xl border text-sm transition-all ${
                    selectedPaymentIds.length === 0 && paymentTotal > 0
                      ? 'border-[var(--color-today)] bg-[var(--color-today)]/10 text-[var(--color-today)] font-medium'
                      : editingAmount
                      ? 'border-[var(--color-today)] bg-[var(--color-today)]/10 text-[var(--color-today)] font-medium'
                      : 'border-[var(--color-border)] text-[var(--color-muted)]'
                  }`}
                >
                  {editingAmount
                    ? `Entering $${paymentInput || '0.00'} manually…`
                    : selectedPaymentIds.length === 0 && paymentTotal > 0
                    ? `Using manual amount · ${fmt(paymentTotal)}`
                    : 'Type a different amount'}
                </button>
              </div>
            )}

            {/* ── Charges to deduct ── */}
            {unpaidItems.length === 0 && !archivedItem ? (
              <p className="text-center py-6 text-sm text-[var(--color-income)]">All charges paid off!</p>
            ) : (
              <div>
                <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest mb-2">
                  {!editingAmount && paymentTotal > 0
                    ? 'Tap a charge to deduct it'
                    : 'Select a payment above or enter an amount'}
                </p>
                <div className="flex flex-col gap-1.5">
                  {groupByMonth(unpaidItems).map(([mk, items]) => (
                    <div key={mk}>
                      <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest mb-1.5 mt-1">
                        {monthLabel(mk)}
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {items.map(item => (
                          <ChargeRow
                            key={item.id}
                            item={item}
                            alloc={allocMap[item.id]}
                            locked={editingAmount || paymentTotal <= 0}
                            leftover={leftover}
                            onToggle={toggleItem}
                            subtitle={
                              <>
                                {shortDate(item.date)}
                                {item.category && <span className="ml-1">· {item.category}</span>}
                                {item.paid_amount > 0 && (
                                  <span className="ml-1 text-[var(--color-today)]">· {fmt(item.paid_amount)} already paid</span>
                                )}
                              </>
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {archivedItem ? (
                    <ArchivedBalanceRow
                      item={archivedItem}
                      alloc={allocMap[archivedItem.id]}
                      locked={editingAmount || paymentTotal <= 0}
                      leftover={leftover}
                      onToggle={toggleItem}
                    />
                  ) : account.debt_archive_date && (
                    <p className="text-[10px] text-[var(--color-muted)] text-center pt-2 mt-1 border-t border-[var(--color-border)]/50">
                      No outstanding balance recorded before {shortDate(account.debt_archive_date)} — set a "Before balance" on this account above if you're carrying debt from before this cutoff.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Reset section */}
          <div className="px-4 pb-4 border-t border-[var(--color-border)]/50 pt-3">
            {confirmReset ? (
              <div className="flex items-center gap-3">
                <p className="text-[11px] text-[var(--color-expense)] flex-1">Reset all payments for {account.name}?</p>
                <button onClick={doReset} disabled={resetting}
                  className="text-xs font-semibold text-[var(--color-expense)] disabled:opacity-50">
                  {resetting ? '…' : 'Yes, reset'}
                </button>
                <button onClick={() => setConfirmReset(false)} className="text-xs text-[var(--color-muted)]">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmReset(true)}
                className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-expense)] transition-colors">
                Reset all payments for this account…
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pt-3 pb-5 border-t border-[var(--color-border)] flex-shrink-0">
          {error && <p className="text-xs text-[var(--color-expense)] mb-2">{error}</p>}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--color-muted)]">
                {selectedIds.length === 0 ? 'No charges selected' : `${selectedIds.length} charge${selectedIds.length !== 1 ? 's' : ''} selected`}
              </p>
              {allocatedTotal > 0 && (
                <p className="text-base font-bold font-mono text-[var(--color-text)]">{fmt(allocatedTotal)} to pay</p>
              )}
            </div>
            <button
              onClick={apply}
              disabled={applying || selectedIds.length === 0}
              className="flex-shrink-0 px-6 py-3 rounded-xl bg-[var(--color-today)] text-black text-sm font-bold disabled:opacity-40 transition-opacity"
            >
              {applying ? 'Applying…' : 'Apply Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Before Balance / Credit Limit row ─────────────────────────────────────────

function BeforeBalanceRow({ account, onSaved }) {
  const [editing, setEditing]           = useState(false)
  const [balanceDraft, setBalanceDraft] = useState('')
  const [limitDraft, setLimitDraft]     = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState(null)

  function startEdit() {
    setBalanceDraft(account.balance != null ? String(account.balance) : '')
    setLimitDraft(account.credit_limit != null ? String(account.credit_limit) : '')
    setError(null)
    setEditing(true)
  }

  async function save() {
    const balanceVal = parseFloat(balanceDraft)
    if (isNaN(balanceVal)) { setError('Enter a valid balance'); return }
    const limitVal = limitDraft.trim() === '' ? null : parseFloat(limitDraft)
    if (limitVal !== null && isNaN(limitVal)) { setError('Enter a valid limit'); return }
    setSaving(true)
    setError(null)
    try {
      const updated = await updateAccount(account.id, { balance: balanceVal, credit_limit: limitVal })
      onSaved(updated)
      setEditing(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const overLimit = account.credit_limit != null && Math.abs(account.balance) > account.credit_limit

  if (editing) {
    return (
      <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg)] flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-[var(--color-muted)] mb-1 block">Before balance ($)</label>
            <input
              type="number" step="0.01"
              value={balanceDraft}
              onChange={e => setBalanceDraft(e.target.value)}
              autoFocus
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-sm font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--color-muted)] mb-1 block">Credit limit ($)</label>
            <input
              type="number" step="0.01"
              value={limitDraft}
              onChange={e => setLimitDraft(e.target.value)}
              placeholder="Optional"
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-sm font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
            />
          </div>
        </div>
        <p className="text-[10px] text-[var(--color-muted)]">
          Debt owed before your imported transactions started, so this account's outstanding total reflects reality. Negative for money owed. Credit limit is used to flag over-limit balances.
        </p>
        {error && <p className="text-[11px] text-[var(--color-expense)]">{error}</p>}
        <div className="flex gap-3">
          <button onClick={save} disabled={saving}
            className="text-xs font-semibold text-[var(--color-today)] disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => setEditing(false)} className="text-xs text-[var(--color-muted)]">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-bg)] flex items-center justify-between">
      <p className="text-[11px] text-[var(--color-muted)]">
        Before balance <span className="text-[var(--color-text)] font-mono">{fmt(account.balance || 0)}</span>
        {account.credit_limit != null && (
          <>
            {'  ·  Limit '}
            <span className={`font-mono ${overLimit ? 'text-[var(--color-expense)]' : 'text-[var(--color-text)]'}`}>{fmt(account.credit_limit)}</span>
            {overLimit && <span className="ml-1 text-[var(--color-expense)]">over limit</span>}
          </>
        )}
      </p>
      <button onClick={startEdit} className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors flex-shrink-0 ml-2">
        Edit
      </button>
    </div>
  )
}

// ─── Archive cutoff (collapse old charges into a lump total) ─────────────────

function ArchiveRow({ account, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [dateDraft, setDateDraft] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)

  function startEdit() {
    setDateDraft(account.debt_archive_date ?? '')
    setError(null)
    setEditing(true)
  }

  async function save() {
    if (!dateDraft) { setError('Pick a date'); return }
    setSaving(true)
    setError(null)
    try {
      const updated = await updateAccount(account.id, { debt_archive_date: dateDraft })
      onSaved(updated)
      setEditing(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function clear() {
    setSaving(true)
    setError(null)
    try {
      const updated = await updateAccount(account.id, { debt_archive_date: null })
      onSaved(updated)
      setEditing(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg)] flex flex-col gap-2">
        <label className="text-[10px] text-[var(--color-muted)] mb-1 block">Collapse charges before this date</label>
        <input
          type="date"
          value={dateDraft}
          onChange={e => setDateDraft(e.target.value)}
          autoFocus
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-sm font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
        />
        <p className="text-[10px] text-[var(--color-muted)]">
          Charges before this date are hidden from the itemized list and rolled into a single "before" total, computed from your transaction history — nothing is deleted.
        </p>
        {error && <p className="text-[11px] text-[var(--color-expense)]">{error}</p>}
        <div className="flex gap-3">
          <button onClick={save} disabled={saving}
            className="text-xs font-semibold text-[var(--color-today)] disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
          {account.debt_archive_date && (
            <button onClick={clear} disabled={saving} className="text-xs text-[var(--color-expense)] disabled:opacity-50">
              Remove cutoff
            </button>
          )}
          <button onClick={() => setEditing(false)} className="text-xs text-[var(--color-muted)]">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (!account.debt_archive_date) {
    return (
      <div className="px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg)]">
        <button onClick={startEdit} className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
          Collapse older charges into one total…
        </button>
      </div>
    )
  }

  const overLimit = account.credit_limit != null && account.total_debt != null && account.total_debt > account.credit_limit

  return (
    <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest mb-1">Total owed</p>
          <p className={`text-2xl font-bold font-mono ${overLimit ? 'text-[var(--color-expense)]' : 'text-[var(--color-text)]'}`}>
            {fmt(account.total_debt || 0)}
            {account.credit_limit != null && (
              <span className="text-sm text-[var(--color-muted)] font-normal"> / {fmt(account.credit_limit)}</span>
            )}
          </p>
          {overLimit && <p className="text-[10px] text-[var(--color-expense)] mt-0.5">over limit</p>}
        </div>
        <button onClick={startEdit} className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors flex-shrink-0 ml-2">
          Edit
        </button>
      </div>
      <p className="text-[11px] text-[var(--color-muted)] mt-2">
        Since {shortDate(account.debt_archive_date)} <span className="text-[var(--color-text)] font-mono">{fmt(account.since_archive_debt || 0)}</span>
        {'  ·  Before that '}
        <span className="text-[var(--color-text)] font-mono">{fmt(account.archived_remaining ?? account.archived_debt ?? 0)}</span>
        {account.archived_paid_amount > 0 && (
          <span className="ml-1 text-[var(--color-today)]">({fmt(account.archived_paid_amount)} paid)</span>
        )}
      </p>
    </div>
  )
}

// ─── Linked Transactions (payment <-> charge audit trail) ─────────────────────

function groupLinksByPayment(links) {
  const groups = new Map()
  for (const link of links) {
    const key = link.payment ? `p-${link.payment.id}` : `m-${link.id}`
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        payment: link.payment,
        date: link.payment ? link.payment.date : link.charge?.date,
        links: [],
      })
    }
    groups.get(key).links.push(link)
  }
  return [...groups.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

function TxnEditForm({ txn, sign, onSaved, onCancel }) {
  const [desc, setDesc] = useState(txn.description)
  const [amt, setAmt] = useState(txn.amount.toString())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function save() {
    const val = parseFloat(amt)
    if (!desc.trim() || isNaN(val) || val <= 0) { setError('Enter a description and a valid amount'); return }
    setSaving(true)
    setError(null)
    try {
      await patchTransaction(txn.id, { description: desc.trim(), amount: sign * val })
      onSaved()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5 py-1.5" onClick={e => e.stopPropagation()}>
      <input
        type="text"
        value={desc}
        onChange={e => setDesc(e.target.value)}
        autoFocus
        className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
      />
      <div className="flex items-center gap-1.5">
        <input
          type="number" step="0.01" min="0.01"
          value={amt}
          onChange={e => setAmt(e.target.value)}
          className="w-24 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
        />
        <button onClick={save} disabled={saving} className="text-xs font-semibold text-[var(--color-today)] disabled:opacity-50">
          {saving ? '…' : 'Save'}
        </button>
        <button onClick={onCancel} className="text-xs text-[var(--color-muted)]">Cancel</button>
      </div>
      {error && <p className="text-[10px] text-[var(--color-expense)]">{error}</p>}
    </div>
  )
}

function GroupChargeRow({ link, onChanged }) {
  const [editingAmt, setEditingAmt] = useState(false)
  const [editingTxn, setEditingTxn] = useState(false)
  const [draft, setDraft] = useState(link.amount.toString())
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState(null)

  async function saveAmount() {
    const val = parseFloat(draft)
    if (isNaN(val) || val <= 0) { setError('Enter a valid amount'); return }
    setSaving(true)
    setError(null)
    try {
      await updateDebtLink(link.id, val)
      onChanged()
      setEditingAmt(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function unlink() {
    setSaving(true)
    try {
      await deleteDebtLink(link.id)
      onChanged()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  if (editingTxn && link.charge) {
    return (
      <div className="py-1 border-b border-[var(--color-border)]/40 last:border-b-0">
        <p className="text-[10px] text-[var(--color-muted)]">Editing charge</p>
        <TxnEditForm
          txn={link.charge}
          sign={-1}
          onSaved={() => { onChanged(); setEditingTxn(false) }}
          onCancel={() => setEditingTxn(false)}
        />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-2 gap-2 border-b border-[var(--color-border)]/40 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[var(--color-text)] truncate">{link.charge?.description ?? 'Deleted charge'}</p>
        <p className="text-[10px] text-[var(--color-muted)] truncate flex items-center gap-1.5">
          {link.charge && dateWithYear(link.charge.date)}
          {link.charge && (
            <button onClick={() => setEditingTxn(true)} className="text-[var(--color-muted)] underline decoration-dotted hover:text-[var(--color-text)]">
              edit
            </button>
          )}
        </p>
      </div>

      {editingAmt ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input
            type="number" step="0.01" min="0.01"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
            className="w-20 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-today)]"
          />
          <button onClick={saveAmount} disabled={saving} className="text-xs font-semibold text-[var(--color-today)] disabled:opacity-50">
            {saving ? '…' : 'Save'}
          </button>
          <button onClick={() => { setEditingAmt(false); setError(null) }} className="text-xs text-[var(--color-muted)]">✕</button>
        </div>
      ) : confirming ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] text-[var(--color-expense)]">Unlink?</span>
          <button onClick={unlink} disabled={saving} className="text-xs font-semibold text-[var(--color-expense)] disabled:opacity-50">
            {saving ? '…' : 'Yes'}
          </button>
          <button onClick={() => setConfirming(false)} className="text-xs text-[var(--color-muted)]">No</button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-mono font-semibold text-[var(--color-text)]">{fmt(link.amount)}</span>
          <button onClick={() => { setDraft(link.amount.toString()); setEditingAmt(true) }}
            className="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors" aria-label="Edit allocated amount">
            <EditIcon />
          </button>
          <button onClick={() => setConfirming(true)}
            className="p-1 text-[var(--color-muted)] hover:text-[var(--color-expense)] transition-colors" aria-label="Unlink">
            <TrashIcon />
          </button>
        </div>
      )}
      {error && <p className="text-[10px] text-[var(--color-expense)] w-full">{error}</p>}
    </div>
  )
}

function PaymentGroup({ group, onChanged }) {
  const [expanded, setExpanded] = useState(false)
  const [editingTxn, setEditingTxn] = useState(false)
  const totalLinked = r2(group.links.reduce((s, l) => s + l.amount, 0))

  return (
    <div className="border-b border-[var(--color-border)]/40 last:border-b-0">
      {editingTxn && group.payment ? (
        <div className="py-1.5">
          <p className="text-[10px] text-[var(--color-muted)]">Editing payment</p>
          <TxnEditForm
            txn={group.payment}
            sign={1}
            onSaved={() => { onChanged(); setEditingTxn(false) }}
            onCancel={() => setEditingTxn(false)}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 py-2">
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex-1 min-w-0 text-left flex items-center gap-2"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={`flex-shrink-0 text-[var(--color-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--color-text)] truncate">
                {group.payment ? group.payment.description : 'Manual entry'}
              </p>
              <p className="text-[10px] text-[var(--color-muted)]">
                {group.date && dateWithYear(group.date)}
                {' · '}{group.links.length} charge{group.links.length !== 1 ? 's' : ''}
                {!group.payment && ' · no linked payment'}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm font-mono font-semibold text-[var(--color-income)]">{fmt(totalLinked)}</span>
            {group.payment && (
              <button onClick={() => setEditingTxn(true)}
                className="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors" aria-label="Edit payment">
                <EditIcon />
              </button>
            )}
          </div>
        </div>
      )}
      {expanded && !editingTxn && (
        <div className="pl-4 pb-2">
          {group.links.map(link => <GroupChargeRow key={link.id} link={link} onChanged={onChanged} />)}
        </div>
      )}
    </div>
  )
}

function DismissedRow({ payment, onChanged }) {
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState(null)

  async function restore() {
    setRestoring(true)
    setError(null)
    try {
      await undismissDebtPayment(payment.id)
      onChanged()
    } catch (e) {
      setError(e.message)
      setRestoring(false)
    }
  }

  return (
    <div className="flex items-center justify-between py-2.5 gap-2 border-b border-[var(--color-border)]/40 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[var(--color-text)] truncate">{payment.description}</p>
        <p className="text-[10px] text-[var(--color-muted)] truncate">
          {dateWithYear(payment.date)}{' · '}<span className="italic">dismissed, not linked to a charge</span>
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-mono font-semibold text-[var(--color-text)]">{fmt(payment.amount)}</span>
        <button onClick={restore} disabled={restoring}
          className="text-xs font-semibold text-[var(--color-today)] disabled:opacity-50">
          {restoring ? '…' : 'Restore'}
        </button>
      </div>
      {error && <p className="text-[10px] text-[var(--color-expense)] w-full">{error}</p>}
    </div>
  )
}

function LinkedTransactionsSection({ account, onChanged }) {
  const [expanded, setExpanded] = useState(false)
  const links = account.links || []
  const dismissed = account.dismissed_payments || []
  const groups = useMemo(() => groupLinksByPayment(account.links || []), [account.links])

  if (links.length === 0 && dismissed.length === 0) return null

  return (
    <div className="border-t border-[var(--color-border)]">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        <span>
          {links.length} linked payment{links.length !== 1 ? 's' : ''}
          {dismissed.length > 0 && ` · ${dismissed.length} dismissed`}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-3">
          {groups.length > 0 && (
            <>
              <p className="text-[10px] text-[var(--color-muted)] mb-1">Tap a payment to see the charges it covered — edit the transaction, adjust the amount, or unlink.</p>
              {groups.map(g => <PaymentGroup key={g.key} group={g} onChanged={onChanged} />)}
            </>
          )}
          {dismissed.length > 0 && (
            <>
              <p className="text-[10px] text-[var(--color-muted)] mt-3 mb-1">Marked "already counted" — not linked to any charge. Restore if that was a mistake.</p>
              {dismissed.map(p => <DismissedRow key={p.id} payment={p} onChanged={onChanged} />)}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Debt Card (one credit account, one month) ────────────────────────────────

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function DebtCard({ account, onResetAccount, onAccountSaved }) {
  const [showDrawer, setShowDrawer]     = useState(false)
  const [showPaid, setShowPaid]         = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting]       = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deletingId, setDeletingId]           = useState(null)

  const unpaidItems    = account.monthItems.filter(i => !i.is_paid)
  const paidItems      = account.monthItems.filter(i => i.is_paid)
  const totalRemaining = r2(unpaidItems.reduce((s, i) => s + i.remaining, 0))

  async function handleDeleteItem(id) {
    setDeletingId(id)
    try {
      await deleteTransaction(id)
      setConfirmDeleteId(null)
      onResetAccount()
    } catch (e) {
      console.error(e)
    } finally {
      setDeletingId(null)
    }
  }

  async function doReset() {
    setResetting(true)
    try {
      await resetDebtPayments(account.id)
      onResetAccount()
      setConfirmReset(false)
    } catch (e) {
      console.error(e)
    } finally {
      setResetting(false)
    }
  }

  return (
    <>
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden mb-4">

        {/* Account header */}
        <div className="px-4 py-3 bg-[var(--color-surface-2)] flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--color-text)]">{account.name}</p>
            <p className="text-xs text-[var(--color-muted)]">{BANK_LABEL[account.bank] ?? account.bank}</p>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold font-mono ${totalRemaining > 0 ? 'text-[var(--color-expense)]' : 'text-[var(--color-income)]'}`}>
              {fmt(totalRemaining)}
            </p>
            <p className="text-[10px] text-[var(--color-muted)]">
              {totalRemaining > 0 ? 'outstanding' : 'all paid'}
            </p>
          </div>
        </div>

        <BeforeBalanceRow account={account} onSaved={updated => onAccountSaved(updated)} />
        <ArchiveRow account={account} onSaved={() => onResetAccount()} />

        {account.monthItems.length === 0 ? (
          <div className="px-4 py-5 flex items-center gap-2 text-[var(--color-muted)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p className="text-sm">No transactions this month — import your CSV to see charges.</p>
          </div>
        ) : unpaidItems.length === 0 ? (
          <div className="px-4 py-5 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-income)] flex-shrink-0">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <p className="text-sm text-[var(--color-income)]">All charges paid this month</p>
          </div>
        ) : (
          <>
            {/* Charge list */}
            <div className="divide-y divide-[var(--color-border)] px-4">
              {unpaidItems.map(item => (
                <div key={item.id} className="flex items-center justify-between py-3 gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--color-text)] truncate">{item.description}</p>
                    <p className="text-[10px] text-[var(--color-muted)]">
                      {shortDate(item.date)}
                      {item.category && <span className="ml-1">· {item.category}</span>}
                    </p>
                  </div>
                  {confirmDeleteId === item.id ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] text-[var(--color-expense)]">Delete?</span>
                      <button onClick={() => handleDeleteItem(item.id)} disabled={deletingId === item.id}
                        className="text-xs font-semibold text-[var(--color-expense)] disabled:opacity-50">
                        {deletingId === item.id ? '…' : 'Yes'}
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-[var(--color-muted)]">Cancel</button>
                    </div>
                  ) : (
                    <>
                      <div className="text-right ml-3 flex-shrink-0">
                        {item.paid_amount > 0 ? (
                          <>
                            <p className="text-sm font-mono font-semibold text-[var(--color-expense)]">{fmt(item.remaining)}</p>
                            <p className="text-[10px] font-mono text-[var(--color-today)]">{fmt(item.paid_amount)} paid</p>
                          </>
                        ) : (
                          <p className="text-sm font-mono font-semibold text-[var(--color-expense)]">{fmt(item.amount)}</p>
                        )}
                      </div>
                      <button onClick={() => setConfirmDeleteId(item.id)}
                        className="flex-shrink-0 p-1 text-[var(--color-muted)] hover:text-[var(--color-expense)] transition-colors"
                        aria-label="Delete transaction">
                        <TrashIcon />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Make payment */}
            <div className="px-4 pb-4 pt-3">
              <button
                onClick={() => setShowDrawer(true)}
                className="w-full py-3 rounded-xl bg-[var(--color-today)] text-black text-sm font-bold hover:opacity-90 transition-opacity"
              >
                Make a Payment
              </button>
            </div>
          </>
        )}

        {/* Paid items */}
        {paidItems.length > 0 && (
          <div className="border-t border-[var(--color-border)]">
            <button
              onClick={() => setShowPaid(p => !p)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-income)]">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {paidItems.length} paid item{paidItems.length !== 1 ? 's' : ''} · {fmt(paidItems.reduce((s, i) => s + i.amount, 0))}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform ${showPaid ? 'rotate-180' : ''}`}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {showPaid && (
              <div className="px-4 pb-4">
                <div className="divide-y divide-[var(--color-border)]">
                  {paidItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between py-2.5 gap-2">
                      <div className="min-w-0 flex-1 opacity-50">
                        <p className="text-sm text-[var(--color-text)] line-through truncate">{item.description}</p>
                        <p className="text-[10px] text-[var(--color-muted)]">{shortDate(item.date)}</p>
                      </div>
                      {confirmDeleteId === item.id ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[11px] text-[var(--color-expense)]">Delete?</span>
                          <button onClick={() => handleDeleteItem(item.id)} disabled={deletingId === item.id}
                            className="text-xs font-semibold text-[var(--color-expense)] disabled:opacity-50">
                            {deletingId === item.id ? '…' : 'Yes'}
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-[var(--color-muted)]">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 ml-3 flex-shrink-0 opacity-50">
                          <span className="text-sm font-mono text-[var(--color-income)]">{fmt(item.amount)}</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-income)]">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          <button onClick={() => setConfirmDeleteId(item.id)}
                            className="p-1 text-[var(--color-muted)] hover:text-[var(--color-expense)] transition-colors"
                            aria-label="Delete transaction">
                            <TrashIcon />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-2 border-t border-[var(--color-border)]">
                  {confirmReset ? (
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] text-[var(--color-expense)] flex-1">Reset this month's paid items?</p>
                      <button onClick={doReset} disabled={resetting}
                        className="text-xs text-[var(--color-expense)] font-semibold disabled:opacity-50">
                        {resetting ? '…' : 'Yes, reset'}
                      </button>
                      <button onClick={() => setConfirmReset(false)} className="text-xs text-[var(--color-muted)]">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmReset(true)}
                      className="text-xs text-[var(--color-muted)] hover:text-[var(--color-expense)] transition-colors">
                      Reset paid items for new cycle…
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <LinkedTransactionsSection account={account} onChanged={onResetAccount} />
      </div>

      {showDrawer && (
        <PaymentDrawer
          account={account}
          onClose={() => setShowDrawer(false)}
          onReset={onResetAccount}
        />
      )}
    </>
  )
}

// ─── DebtPage ─────────────────────────────────────────────────────────────────

export default function DebtPage() {
  const [debtData, setDebtData]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [loadError, setLoadError]     = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resettingAll, setResettingAll] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    fetchDebt()
      .then(setDebtData)
      .catch(e => setLoadError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // All months that have at least one charge, sorted newest first
  const availableMonths = useMemo(() => {
    const set = new Set()
    for (const acct of debtData) {
      for (const item of acct.items) {
        set.add(item.date.slice(0, 7))
      }
    }
    return [...set].sort().reverse()
  }, [debtData])

  // Auto-select the most recent month once data loads
  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0])
    }
  }, [availableMonths])

  // Accounts scoped to the selected month — always include all accounts
  const monthAccounts = useMemo(() =>
    debtData.map(acct => ({
      ...acct,
      monthItems:    acct.items.filter(i => i.date.startsWith(selectedMonth)),
      monthPayments: (acct.payments || []).filter(p => p.date.startsWith(selectedMonth)),
    })),
    [debtData, selectedMonth]
  )

  async function resetAll() {
    setResettingAll(true)
    try {
      await resetDebtPayments()
      const fresh = await fetchDebt()
      setDebtData(fresh)
      setConfirmReset(false)
    } catch (e) {
      console.error(e)
    } finally {
      setResettingAll(false)
    }
  }

  function handleResetAccount() {
    fetchDebt().then(setDebtData).catch(() => {})
  }

  function handleAccountSaved(updatedAccount) {
    setDebtData(prev => prev.map(acct =>
      acct.id === updatedAccount.id
        ? { ...acct, balance: updatedAccount.balance, balance_date: updatedAccount.balance_date, credit_limit: updatedAccount.credit_limit }
        : acct
    ))
  }

  // Total payments received across all debts that haven't been allocated to any charge yet
  const totalUnapplied = useMemo(() =>
    r2(debtData.reduce((s, acct) => s + (acct.payments || []).reduce((s2, p) => s2 + p.amount, 0), 0)),
    [debtData]
  )

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-6 max-w-lg mx-auto pb-24">
      <div className="mb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text)]">Debt Tracker</h1>
            <p className="text-xs text-[var(--color-muted)] mt-1">
              Track and pay off charges on your credit cards.
            </p>
          </div>
          {debtData.length > 0 && !loading && (
            confirmReset ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-[var(--color-expense)]">Reset all payments?</span>
                <button onClick={resetAll} disabled={resettingAll}
                  className="text-xs font-semibold text-[var(--color-expense)] disabled:opacity-50">
                  {resettingAll ? '…' : 'Yes'}
                </button>
                <button onClick={() => setConfirmReset(false)} className="text-xs text-[var(--color-muted)]">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmReset(true)}
                className="mt-1 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-expense)] transition-colors">
                Reset all
              </button>
            )
          )}
        </div>
      </div>

      {loading && <p className="text-center py-20 text-[var(--color-muted)]">Loading…</p>}
      {loadError && <p className="text-center py-10 text-[var(--color-expense)] text-sm">{loadError}</p>}

      {!loading && !loadError && debtData.length === 0 && (
        <div className="text-center py-16 border border-dashed border-[var(--color-border)] rounded-xl px-6">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-[var(--color-muted)] mx-auto mb-3">
            <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
          <p className="text-[var(--color-text)] text-sm font-medium mb-1">No credit accounts set up</p>
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">
            Go to <span className="text-[var(--color-today)]">Accounts</span> and add a credit card or line of credit to start tracking it here.
          </p>
        </div>
      )}

      {!loading && !loadError && debtData.length > 0 && (
        <>
          {totalUnapplied > 0 && (
            <div className="mb-5 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-widest">Unapplied payments</p>
                <p className="text-[11px] text-[var(--color-muted)] mt-0.5">Received but not yet allocated to a charge, across all debts</p>
              </div>
              <p className="text-xl font-bold font-mono text-[var(--color-today)] flex-shrink-0 ml-3">{fmt(totalUnapplied)}</p>
            </div>
          )}

          {availableMonths.length > 0 && (
            <MonthNav
              months={availableMonths}
              selected={selectedMonth}
              onSelect={setSelectedMonth}
            />
          )}

          {monthAccounts.map(account => (
            <DebtCard key={account.id} account={account} onResetAccount={handleResetAccount} onAccountSaved={handleAccountSaved} />
          ))}
        </>
      )}
    </div>
  )
}
