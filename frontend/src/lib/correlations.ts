import type { Measurement } from './api'

// Inputs: things the cat consumes or does — leading behavioral indicators
export const INPUT_TYPES = new Set(['food', 'water', 'grooming', 'activity', 'play'])

// Outcomes: health results that reflect the cat's internal state
export const OUTCOME_TYPES = new Set(['weight', 'vomiting', 'litter'])

export interface WeeklyBucket {
  weekKey: string
  weekStart: Date
  value: number
}

export interface CorrelationResult {
  typeA: string
  typeB: string
  lag: number          // weeks B lags behind A
  r: number            // Pearson correlation coefficient
  direction: 'positive' | 'negative'
  strength: 'none' | 'weak' | 'notable'
  isPredictive: boolean
  isHyperthyroidismPattern: boolean
}

function getWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function weekKeyToDate(weekKey: string): Date {
  const [yearStr, weekStr] = weekKey.split('-W')
  const year = parseInt(yearStr)
  const week = parseInt(weekStr)
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const weekStart = new Date(jan4)
  weekStart.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1 + (week - 1) * 7)
  return weekStart
}

export function bucketByWeek(measurements: Measurement[]): WeeklyBucket[] {
  const byWeek = new Map<string, number[]>()
  for (const m of measurements) {
    const key = getWeekKey(new Date(m.measured_at))
    const bucket = byWeek.get(key) ?? []
    bucket.push(m.value)
    byWeek.set(key, bucket)
  }
  const buckets: WeeklyBucket[] = []
  for (const [weekKey, values] of byWeek) {
    const avg = values.reduce((s, v) => s + v, 0) / values.length
    buckets.push({ weekKey, weekStart: weekKeyToDate(weekKey), value: avg })
  }
  buckets.sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
  return buckets
}

export function normalize(values: number[]): number[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return values.map(() => 0.5)
  return values.map((v) => (v - min) / (max - min))
}

function pearson(a: number[], b: number[]): number {
  const n = a.length
  if (n < 2) return 0
  const meanA = a.reduce((s, v) => s + v, 0) / n
  const meanB = b.reduce((s, v) => s + v, 0) / n
  let num = 0, denA = 0, denB = 0
  for (let i = 0; i < n; i++) {
    const da = (a[i] ?? 0) - meanA
    const db = (b[i] ?? 0) - meanB
    num += da * db
    denA += da * da
    denB += db * db
  }
  if (denA === 0 || denB === 0) return 0
  return num / Math.sqrt(denA * denB)
}

/**
 * Find the lag (0–maxLag weeks) at which series A best predicts series B.
 * A positive lag means B follows A by that many weeks.
 */
export function lagCorrelation(a: number[], b: number[], maxLag = 4): { lag: number; r: number } {
  let bestLag = 0
  let bestR = 0
  for (let lag = 0; lag <= maxLag; lag++) {
    const aSlice = a.slice(0, a.length - lag)
    const bSlice = b.slice(lag)
    if (aSlice.length < 4) break
    const r = pearson(aSlice, bSlice)
    if (Math.abs(r) > Math.abs(bestR)) {
      bestR = r
      bestLag = lag
    }
  }
  return { lag: bestLag, r: bestR }
}

function alignSeries(a: WeeklyBucket[], b: WeeklyBucket[]): { aVals: number[]; bVals: number[] } {
  const aMap = new Map(a.map((x) => [x.weekKey, x.value]))
  const bMap = new Map(b.map((x) => [x.weekKey, x.value]))
  const allKeys = [...new Set([...aMap.keys(), ...bMap.keys()])].sort()
  const aVals: number[] = []
  const bVals: number[] = []
  for (const key of allKeys) {
    if (aMap.has(key) && bMap.has(key)) {
      aVals.push(aMap.get(key)!)
      bVals.push(bMap.get(key)!)
    }
  }
  return { aVals, bVals }
}

// Known clinically-meaningful pairs to check: [predictor, outcome]
const KNOWN_PAIRS: Array<[string, string]> = [
  ['food', 'weight'],
  ['water', 'weight'],
  ['grooming', 'weight'],
  ['activity', 'weight'],
  ['vomiting', 'weight'],
]

export function detectCorrelations(allMeasurements: Record<string, Measurement[]>): CorrelationResult[] {
  const results: CorrelationResult[] = []

  for (const [typeA, typeB] of KNOWN_PAIRS) {
    const measA = allMeasurements[typeA]
    const measB = allMeasurements[typeB]
    if (!measA || !measB || measA.length < 4 || measB.length < 4) continue

    const bucketsA = bucketByWeek(measA)
    const bucketsB = bucketByWeek(measB)
    if (bucketsA.length < 4 || bucketsB.length < 4) continue

    const { aVals, bVals } = alignSeries(bucketsA, bucketsB)
    if (aVals.length < 4) continue

    const { lag, r } = lagCorrelation(aVals, bVals)
    const absR = Math.abs(r)
    const strength: CorrelationResult['strength'] =
      absR >= 0.6 ? 'notable' : absR >= 0.3 ? 'weak' : 'none'

    // Hyperthyroidism pattern: eating more but losing weight simultaneously
    const isHyperthyroidismPattern = typeA === 'food' && typeB === 'weight' && r < -0.5 && lag === 0

    // Predictive: typeA recently changed, typeB hasn't caught up yet
    let isPredictive = false
    if (strength !== 'none' && lag > 0) {
      const recentA = bucketsA.slice(-2).map((b) => b.value)
      const recentB = bucketsB.slice(-2).map((b) => b.value)
      if (recentA.length === 2 && recentB.length === 2) {
        const aChanged = Math.abs((recentA[1] ?? 0) - (recentA[0] ?? 0)) / ((recentA[0] ?? 1) || 1) > 0.05
        const bStable = Math.abs((recentB[1] ?? 0) - (recentB[0] ?? 0)) / ((recentB[0] ?? 1) || 1) < 0.05
        isPredictive = aChanged && bStable
      }
    }

    results.push({ typeA, typeB, lag, r, direction: r >= 0 ? 'positive' : 'negative', strength, isPredictive, isHyperthyroidismPattern })
  }

  results.sort((a, b) => {
    const rank = (x: CorrelationResult) => (x.strength === 'notable' ? 2 : x.strength === 'weak' ? 1 : 0)
    return rank(b) - rank(a) || Math.abs(b.r) - Math.abs(a.r)
  })

  return results
}

const TYPE_DISPLAY: Record<string, string> = {
  weight: 'weight', food: 'food intake', water: 'water intake',
  grooming: 'grooming', activity: 'activity', vomiting: 'vomiting frequency',
  litter: 'litter box usage',
}

function possessive(sex?: string | null): string {
  if (sex === 'Male') return 'his'
  if (sex === 'Female') return 'her'
  return 'their'
}

export function describeCorrelation(result: CorrelationResult, catName: string, sex?: string | null): string {
  const { typeA, typeB, lag, r, strength, isHyperthyroidismPattern } = result
  const a = TYPE_DISPLAY[typeA] ?? typeA
  const b = TYPE_DISPLAY[typeB] ?? typeB
  const poss = possessive(sex)

  if (strength === 'none') {
    return `No strong pattern detected yet between ${a} and ${b}. Keep logging to see trends emerge.`
  }

  if (isHyperthyroidismPattern) {
    return `${catName} is eating more than usual but still losing weight — an unusual combination worth mentioning to your vet.`
  }

  const lagText =
    lag === 0 ? 'at the same time'
    : lag === 1 ? 'about a week later'
    : `about ${lag} weeks later`

  if (typeA === 'vomiting' && typeB === 'weight') {
    const dirText = r < 0 ? 'drop' : 'rise'
    return `When ${catName}'s vomiting increases, weight tends to ${dirText} ${lagText}. This pattern is worth keeping an eye on.`
  }

  if (lag === 0) {
    return `${catName}'s ${a} and ${b} tend to move together — when one changes, the other often follows around the same time.`
  }

  const dirText = r < 0 ? 'drops' : 'rises'
  return `${catName}'s ${a} tends to change before ${poss} ${b} does — ${b} ${dirText} ${lagText}. Watching ${a} can give you an early signal.`
}

export function getHomeBadge(results: CorrelationResult[]): string | null {
  const hit = results.find((r) => r.strength === 'notable' && r.isPredictive)
  if (!hit) return null
  const labels: Record<string, string> = {
    food: 'food intake', water: 'water intake', grooming: 'grooming', activity: 'activity', vomiting: 'vomiting',
  }
  const a = labels[hit.typeA] ?? hit.typeA
  return hit.r < 0
    ? `Drop in ${a} may affect weight soon`
    : `Change in ${a} may affect weight soon`
}
