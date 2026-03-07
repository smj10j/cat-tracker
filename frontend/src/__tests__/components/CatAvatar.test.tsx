import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CatAvatar from '../../components/CatAvatar'

describe('CatAvatar', () => {
  it('renders an img element when photoUrl is provided', () => {
    const { container } = render(
      <CatAvatar photoUrl="https://example.com/cat.jpg" name="Luna" size={56} />,
    )
    // img has alt="" which makes it role="presentation", not "img"
    const img = container.querySelector('img')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/cat.jpg')
  })

  it('renders the emoji fallback div when photoUrl is null', () => {
    const { container } = render(<CatAvatar photoUrl={null} name="Luna" size={56} />)
    expect(screen.queryByRole('img')).toBeNull()
    // The emoji div should be present
    expect(container.textContent).toContain('🐱')
  })

  it('renders the emoji fallback div when photoUrl is undefined', () => {
    const { container } = render(<CatAvatar photoUrl={undefined} name="Luna" size={56} />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.textContent).toContain('🐱')
  })

  it('applies the size to both img and fallback styles', () => {
    const { container: c1 } = render(
      <CatAvatar photoUrl="https://example.com/cat.jpg" name="Luna" size={80} />,
    )
    const img = c1.querySelector('img')
    expect(img?.style.width).toBe('80px')
    expect(img?.style.height).toBe('80px')

    const { container: c2 } = render(<CatAvatar photoUrl={null} name="Luna" size={64} />)
    const div = c2.querySelector('div')
    expect(div?.style.width).toBe('64px')
    expect(div?.style.height).toBe('64px')
  })

  it('applies border-radius 50% for circular shape', () => {
    const { container: c1 } = render(
      <CatAvatar photoUrl="https://example.com/cat.jpg" name="Luna" size={56} />,
    )
    expect(c1.querySelector('img')?.style.borderRadius).toBe('50%')

    const { container: c2 } = render(<CatAvatar photoUrl={null} name="Luna" size={56} />)
    expect(c2.querySelector('div')?.style.borderRadius).toBe('50%')
  })

  it('passes extra className to the rendered element', () => {
    const { container: c1 } = render(
      <CatAvatar photoUrl="https://example.com/cat.jpg" name="Luna" size={56} className="ring-2" />,
    )
    expect(c1.querySelector('img')?.className).toContain('ring-2')

    const { container: c2 } = render(
      <CatAvatar photoUrl={null} name="Luna" size={56} className="ring-2" />,
    )
    expect(c2.querySelector('div')?.className).toContain('ring-2')
  })

  it('hides the img on load error', () => {
    const { container } = render(
      <CatAvatar photoUrl="https://broken.example.com/cat.jpg" name="Luna" size={56} />,
    )
    const img = container.querySelector('img')!

    // Fire the error event to trigger the onError handler
    fireEvent.error(img)

    expect(img.style.display).toBe('none')
  })
})
