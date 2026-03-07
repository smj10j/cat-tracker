import { useState } from 'react'
import BottomNav from './BottomNav'
import QuickAdd from './QuickAdd'

interface Props {
  children: React.ReactNode
}

export default function PageShell({ children }: Props) {
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-night">
      <main className="pb-32">
        {children}
      </main>
      <BottomNav onLog={() => setQuickAddOpen(true)} />
      <QuickAdd open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </div>
  )
}
