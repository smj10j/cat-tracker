import BottomNav from './BottomNav'

interface Props {
  children: React.ReactNode
}

export default function PageShell({ children }: Props) {
  return (
    <div className="min-h-dvh bg-night">
      <main className="pb-32">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
