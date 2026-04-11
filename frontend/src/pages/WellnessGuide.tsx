import { useState } from 'react'
import { useGoBack } from '../hooks/useGoBack'
import { URGENT_VET_SIGNS } from '../lib/healthMetrics'

interface WellnessCard {
  icon: string
  title: string
  items: string[]
}

const WELLNESS_CARDS: WellnessCard[] = [
  {
    icon: '📋',
    title: 'Monthly Self-Check',
    items: [
      'Weigh my cat and log it here',
      'Run hands over their body — feel for lumps or tender spots',
      'Check coat: shiny, soft, free of mats?',
      'Gums: pink and moist (not pale, yellow, or tacky)?',
      'Eyes: clear, no discharge or cloudiness?',
      'Ears: clean, not smelly or waxy?',
    ],
  },
  {
    icon: '📊',
    title: 'Normal Vitals',
    items: [
      'Temperature: 99–102.5°F (37–39°C)',
      'Resting heart rate: 140–220 bpm',
      'Healthy sleep: 12–16 hours per day',
      'Healthy weight: varies — ask my vet for their target range',
      'Weight loss >10% of body weight: always see a vet',
    ],
  },
  {
    icon: '🚨',
    title: 'Always Call the Vet',
    items: URGENT_VET_SIGNS,
  },
  {
    icon: '🥩',
    title: 'Nutrition Basics',
    items: [
      'Cats are obligate carnivores — high protein is essential',
      'Wet food significantly improves hydration and urinary health',
      'Free-feeding dry kibble is a leading cause of obesity',
      'Target ~20–30 cal per lb of ideal body weight per day',
      'Fresh water access at all times — many cats prefer running water',
    ],
  },
]

export default function WellnessGuide() {
  const goBack = useGoBack('/')
  const [openCard, setOpenCard] = useState<number | null>(null)

  return (
    <div className="min-h-screen px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={goBack} className="text-ink-dim hover:text-ink-mid transition-colors text-xl leading-none">←</button>
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Cat Wellness Guide</h1>
          <p className="text-ink-dim text-xs mt-0.5">Reference for healthy cat care</p>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        {WELLNESS_CARDS.map((card, i) => {
          const isOpen = openCard === i
          const isUrgentCard = card.title === 'Always Call the Vet'
          return (
            <div
              key={card.title}
              className="rounded-2xl overflow-hidden transition-all"
              style={{
                background: isUrgentCard ? 'rgba(248,113,113,0.06)' : 'var(--color-card)',
                border: isUrgentCard ? '1px solid rgba(248,113,113,0.2)' : '1px solid var(--color-card-border)',
              }}
            >
              <button
                onClick={() => setOpenCard(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={`wellness-card-${i}`}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{card.icon}</span>
                  <span
                    className="font-semibold text-sm"
                    style={{ color: isUrgentCard ? '#f87171' : 'var(--color-ink)' }}
                  >
                    {card.title}
                  </span>
                </div>
                <span
                  className="text-ink-dim text-xs transition-transform"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
                >
                  ▾
                </span>
              </button>
              {isOpen && (
                <div id={`wellness-card-${i}`} className="px-4 pb-4">
                  <ul className="space-y-2">
                    {card.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-ink-mid">
                        <span className="shrink-0 mt-0.5" style={{ color: isUrgentCard ? '#f87171' : 'var(--color-ink-dim)' }}>
                          {isUrgentCard ? '•' : '·'}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Source attribution */}
      <div
        className="rounded-2xl px-4 py-3 text-xs leading-relaxed"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-card-border)', color: 'var(--color-ink-dim)' }}
      >
        <p className="font-semibold mb-1" style={{ color: 'var(--color-ink-mid)' }}>About this guide</p>
        <p>
          Health thresholds and urgent-sign criteria follow{' '}
          <strong style={{ color: 'var(--color-ink-mid)' }}>AAFP</strong> (American Association of Feline Practitioners) and{' '}
          <strong style={{ color: 'var(--color-ink-mid)' }}>WSAVA</strong> (World Small Animal Veterinary Association) feline
          nutritional and clinical care guidelines. Behavioral indicators reference ISFM and AAFP consensus
          documents on feline pain recognition and stress. This guide is a reference tool, not a substitute
          for veterinary care. When in doubt, call your vet.
        </p>
      </div>
    </div>
  )
}
