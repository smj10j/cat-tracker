import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from '../../components/ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders title, message, and labeled buttons', () => {
    render(
      <ConfirmDialog
        title="Remove member" message="Remove Alice from this household?"
        confirmLabel="Remove" danger
        onConfirm={() => {}} onCancel={() => {}}
      />
    )
    expect(screen.getByRole('alertdialog', { name: 'Remove member' })).toBeTruthy()
    expect(screen.getByText('Remove Alice from this household?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })

  it('fires onConfirm and onCancel', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog title="T" message="M" onConfirm={onConfirm} onCancel={onCancel} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('cancels on Escape and backdrop click', () => {
    const onCancel = vi.fn()
    const { container } = render(
      <ConfirmDialog title="T" message="M" onConfirm={() => {}} onCancel={onCancel} />
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(container.firstChild as Element)
    expect(onCancel).toHaveBeenCalledTimes(2)
  })
})
