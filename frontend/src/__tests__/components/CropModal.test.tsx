import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import CropModal from '../../components/CropModal'

describe('CropModal', () => {
  it('loads the image as a data: URL (not a blob: URL)', async () => {
    const file = new File(['fake-image-bytes'], 'photo.jpg', { type: 'image/jpeg' })
    const onCrop = vi.fn()
    const onCancel = vi.fn()

    const { container } = render(
      <CropModal file={file} onCrop={onCrop} onCancel={onCancel} />,
    )

    // The img should eventually have a data: URL src (set asynchronously by FileReader)
    await waitFor(() => {
      const img = container.querySelector('img')
      expect(img).not.toBeNull()
      expect(img?.getAttribute('src')).toMatch(/^data:/)
    })
  })

  it('does not use a blob: URL (which can trigger ERR_ACCESS_DENIED)', async () => {
    const file = new File(['fake-image-bytes'], 'photo.jpg', { type: 'image/jpeg' })
    const onCrop = vi.fn()
    const onCancel = vi.fn()

    const { container } = render(
      <CropModal file={file} onCrop={onCrop} onCancel={onCancel} />,
    )

    await waitFor(() => {
      const img = container.querySelector('img')
      expect(img).not.toBeNull()
      // Must never use a blob: URL
      expect(img?.getAttribute('src') ?? '').not.toMatch(/^blob:/)
    })
  })

  it('renders Cancel and Save buttons', () => {
    const file = new File(['fake'], 'photo.jpg', { type: 'image/jpeg' })
    const { getByText } = render(
      <CropModal file={file} onCrop={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(getByText('Cancel')).toBeInTheDocument()
    expect(getByText('Save')).toBeInTheDocument()
  })

  it('calls onCancel when Cancel is clicked', () => {
    const file = new File(['fake'], 'photo.jpg', { type: 'image/jpeg' })
    const onCancel = vi.fn()
    const { getByText } = render(
      <CropModal file={file} onCrop={vi.fn()} onCancel={onCancel} />,
    )
    getByText('Cancel').click()
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
