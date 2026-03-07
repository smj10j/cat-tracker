interface CatAvatarProps {
  photoUrl: string | null | undefined
  name: string
  size: number
  className?: string
}

export default function CatAvatar({ photoUrl, size, className = '' }: CatAvatarProps) {
  const style = { width: size, height: size, borderRadius: '50%', flexShrink: 0 }

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={className}
        style={{ ...style, objectFit: 'cover', display: 'block' }}
        onError={(e) => {
          // On load error fall back to emoji by hiding the img
          const el = e.currentTarget
          el.style.display = 'none'
          const fallback = el.nextElementSibling as HTMLElement | null
          if (fallback) fallback.style.display = 'flex'
        }}
      />
    )
  }

  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ ...style, fontSize: size * 0.45 }}
    >
      🐱
    </div>
  )
}
