import { useCallback, useEffect, useRef, useState } from 'react'

interface CropModalProps {
  file: File
  onCrop: (blob: Blob) => void
  onCancel: () => void
}

const APERTURE = 280   // diameter of the circular crop window (px)
const OUTPUT_SIZE = 400 // output JPEG dimensions (px)
const MIN_SCALE = 1
const MAX_SCALE = 4

export default function CropModal({ file, onCrop, onCancel }: CropModalProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [objectUrl, setObjectUrl] = useState('')
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  // displayed image dimensions at scale=1 (object-contain fit into container)
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 })

  // Drag state (ref so no re-renders during drag)
  const dragRef = useRef<{ startX: number; startY: number; startOffX: number; startOffY: number } | null>(null)
  // Pinch state
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null)

  useEffect(() => {
    const reader = new FileReader()
    reader.onload = (e) => setObjectUrl((e.target?.result as string) ?? '')
    reader.readAsDataURL(file)
  }, [file])

  // When image loads, compute the display size (object-contain into square container = APERTURE+80)
  const containerSize = APERTURE + 80
  const onImgLoad = useCallback(() => {
    const img = imgRef.current
    if (!img) return
    const { naturalWidth: nw, naturalHeight: nh } = img
    const ratio = Math.min(containerSize / nw, containerSize / nh)
    const w = nw * ratio
    const h = nh * ratio
    setDisplaySize({ w, h })
    // Reset: start centered, min zoom so image fills the aperture
    const minScale = Math.max(APERTURE / w, APERTURE / h)
    const initialScale = Math.max(minScale, 1)
    setScale(initialScale)
    setOffset({ x: 0, y: 0 })
  }, [containerSize])

  // Clamp offset so image always covers the aperture
  function clampOffset(ox: number, oy: number, sc: number): { x: number; y: number } {
    const hw = (displaySize.w * sc) / 2
    const hh = (displaySize.h * sc) / 2
    const maxX = hw - APERTURE / 2
    const maxY = hh - APERTURE / 2
    return {
      x: Math.max(-maxX, Math.min(maxX, ox)),
      y: Math.max(-maxY, Math.min(maxY, oy)),
    }
  }

  function applyScale(newScale: number, pivot?: { x: number; y: number }) {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale))
    // Adjust offset toward pivot so the point under the cursor stays put
    if (pivot) {
      const factor = clamped / scale
      const newOx = pivot.x + (offset.x - pivot.x) * factor
      const newOy = pivot.y + (offset.y - pivot.y) * factor
      setOffset(clampOffset(newOx, newOy, clamped))
    } else {
      setOffset(o => clampOffset(o.x, o.y, clamped))
    }
    setScale(clamped)
  }

  // Mouse wheel zoom
  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const delta = -e.deltaY * 0.001
    applyScale(scale + delta * scale)
  }

  // Mouse drag
  function onMouseDown(e: React.MouseEvent) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOffX: offset.x, startOffY: offset.y }
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setOffset(clampOffset(dragRef.current.startOffX + dx, dragRef.current.startOffY + dy, scale))
  }
  function onMouseUp() { dragRef.current = null }

  // Touch drag + pinch
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      const t = e.touches[0]!
      dragRef.current = { startX: t.clientX, startY: t.clientY, startOffX: offset.x, startOffY: offset.y }
    } else if (e.touches.length === 2) {
      dragRef.current = null
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY
      pinchRef.current = { startDist: Math.hypot(dx, dy), startScale: scale }
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    if (e.touches.length === 1 && dragRef.current) {
      const t = e.touches[0]!
      const dx = t.clientX - dragRef.current.startX
      const dy = t.clientY - dragRef.current.startY
      setOffset(clampOffset(dragRef.current.startOffX + dx, dragRef.current.startOffY + dy, scale))
    } else if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY
      const dist = Math.hypot(dx, dy)
      const newScale = pinchRef.current.startScale * (dist / pinchRef.current.startDist)
      applyScale(newScale)
    }
  }
  function onTouchEnd() { dragRef.current = null; pinchRef.current = null }

  function handleSlider(e: React.ChangeEvent<HTMLInputElement>) {
    applyScale(parseFloat(e.target.value))
  }

  function handleSave() {
    const img = imgRef.current
    if (!img || displaySize.w === 0) return

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext('2d')!

    // Map aperture center back to source image coordinates.
    // The image is displayed at displaySize, centered in the container,
    // then transformed by translate(offset.x, offset.y) scale(scale) relative to container center.
    // The aperture center is at container center (0,0 in our coordinate system).
    // So the aperture maps to the image point:
    //   imgX = (0 - offset.x) / scale  (in display-size coords, relative to display image center)
    //   imgY = (0 - offset.y) / scale
    // Then in natural coords: multiply by naturalWidth / displaySize.w

    const scaleToNatural = img.naturalWidth / displaySize.w
    const cropHalfDisplay = (APERTURE / 2) / scale      // half-aperture in display coords
    const cropHalfNatural = cropHalfDisplay * scaleToNatural

    const centerNatX = img.naturalWidth / 2 + (-offset.x / scale) * scaleToNatural
    const centerNatY = img.naturalHeight / 2 + (-offset.y / scale) * scaleToNatural

    const srcX = centerNatX - cropHalfNatural
    const srcY = centerNatY - cropHalfNatural
    const srcSize = cropHalfNatural * 2

    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

    canvas.toBlob((blob) => {
      if (blob) onCrop(blob)
    }, 'image/jpeg', 0.85)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.92)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <button onClick={onCancel} className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Cancel
        </button>
        <span className="text-sm font-semibold text-white">Adjust Photo</span>
        <button
          onClick={handleSave}
          className="text-sm font-semibold"
          style={{ color: 'var(--color-brand)' }}
        >
          Save
        </button>
      </div>

      {/* Crop area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <div
          ref={containerRef}
          style={{ width: containerSize, height: containerSize, position: 'relative', cursor: 'grab' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* The image, transformed */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {objectUrl && (
              <img
                ref={imgRef}
                src={objectUrl}
                alt=""
                onLoad={onImgLoad}
                draggable={false}
                style={{
                  width: displaySize.w || 'auto',
                  height: displaySize.h || 'auto',
                  maxWidth: 'none',
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  transformOrigin: 'center',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>

          {/* Scrim overlay with circular hole */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {/* Top */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: (containerSize - APERTURE) / 2, background: 'rgba(0,0,0,0.55)' }} />
            {/* Bottom */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: (containerSize - APERTURE) / 2, background: 'rgba(0,0,0,0.55)' }} />
            {/* Left */}
            <div style={{ position: 'absolute', top: (containerSize - APERTURE) / 2, left: 0, width: (containerSize - APERTURE) / 2, height: APERTURE, background: 'rgba(0,0,0,0.55)' }} />
            {/* Right */}
            <div style={{ position: 'absolute', top: (containerSize - APERTURE) / 2, right: 0, width: (containerSize - APERTURE) / 2, height: APERTURE, background: 'rgba(0,0,0,0.55)' }} />
            {/* Circle border */}
            <div style={{
              position: 'absolute',
              top: (containerSize - APERTURE) / 2,
              left: (containerSize - APERTURE) / 2,
              width: APERTURE, height: APERTURE,
              borderRadius: '50%',
              border: '2px solid rgba(192,132,252,0.7)',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0)',
            }} />
          </div>
        </div>
      </div>

      {/* Zoom slider */}
      <div className="px-8 pb-8 pt-4 shrink-0 space-y-2">
        <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Drag to reposition · Pinch or scroll to zoom
        </p>
        <input
          type="range"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={0.01}
          value={scale}
          onChange={handleSlider}
          className="w-full accent-purple-400"
        />
      </div>
    </div>
  )
}
