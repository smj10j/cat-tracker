import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface DialogState extends ConfirmOptions {
  resolve: (confirmed: boolean) => void
}

/**
 * In-app replacement for window.confirm — promise-based so call sites stay a
 * one-line guard:
 *
 *   const { confirm, confirmDialog } = useConfirmDialog()
 *   if (!(await confirm({ title: 'Remove member', message: '…', danger: true }))) return
 *   // …render {confirmDialog} once anywhere in the page tree
 */
export function useConfirmDialog(): {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  confirmDialog: ReactNode
} {
  const [state, setState] = useState<DialogState | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve })
    })
  }, [])

  const close = (confirmed: boolean) => {
    state?.resolve(confirmed)
    setState(null)
  }

  const confirmDialog = state ? (
    <ConfirmDialog
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      danger={state.danger}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  ) : null

  return { confirm, confirmDialog }
}

export function ConfirmDialog({
  title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false,
  onConfirm, onCancel,
}: ConfirmOptions & { onConfirm: () => void; onCancel: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display font-bold text-lg text-ink">{title}</h2>
        <p className="text-sm text-ink-mid">{message}</p>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-ink-mid transition-all min-h-[44px]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-rim)' }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[44px]"
            style={danger
              ? { color: 'var(--color-health-rose)', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)' }
              : { color: 'var(--color-brand)', background: 'rgba(192,132,252,0.12)', border: '1px solid rgba(192,132,252,0.35)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
