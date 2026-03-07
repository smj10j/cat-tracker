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
  lag: number              // weeks B lags behind A
  r: number                // Pearson correlation coefficient
  direction: 'positive' | 'negative'
  strength: 'none' | 'weak' | 'notable'
  isPredictive: boolean
  isHyperthyroidismPattern: boolean
  typeATrend: 'up' | 'down' | 'stable'   // actual trend of typeA over data window
  typeBTrend: 'up' | 'down' | 'stable'   // actual trend of typeB over data window
  dataWeeks: number                        // weeks of overlapping data used
}

export interface ConfluenceResult {
  clusterName: string
  pairKeys: string[]     // e.g. ['water→weight', 'vomiting→weight']
  ownerMessage: string
  vetNote: string
}

// ─── Math helpers ────────────────────────────────────────────────────────────

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

/**
 * Detect whether a series is trending up, down, or stable by comparing
 * the average of the first half vs the second half of weekly buckets.
 */
export function detectTrend(buckets: WeeklyBucket[]): 'up' | 'down' | 'stable' {
  if (buckets.length < 4) return 'stable'
  const mid = Math.floor(buckets.length / 2)
  const first = buckets.slice(0, mid)
  const second = buckets.slice(mid)
  const avgFirst = first.reduce((s, b) => s + b.value, 0) / first.length
  const avgSecond = second.reduce((s, b) => s + b.value, 0) / second.length
  const changePct = Math.abs(avgSecond - avgFirst) / (avgFirst || 1)
  if (changePct < 0.04) return 'stable'
  return avgSecond > avgFirst ? 'up' : 'down'
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

// ─── Detection ───────────────────────────────────────────────────────────────

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

    const isHyperthyroidismPattern = typeA === 'food' && typeB === 'weight' && r < -0.5 && lag === 0

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

    const typeATrend = detectTrend(bucketsA)
    const typeBTrend = detectTrend(bucketsB)
    const dataWeeks = aVals.length   // aligned overlap weeks

    results.push({
      typeA, typeB, lag, r,
      direction: r >= 0 ? 'positive' : 'negative',
      strength, isPredictive, isHyperthyroidismPattern,
      typeATrend, typeBTrend, dataWeeks,
    })
  }

  results.sort((a, b) => {
    const rank = (x: CorrelationResult) => (x.strength === 'notable' ? 2 : x.strength === 'weak' ? 1 : 0)
    return rank(b) - rank(a) || Math.abs(b.r) - Math.abs(a.r)
  })

  return results
}

// ─── Confluence detection ─────────────────────────────────────────────────────

interface ClusterSpec {
  name: string
  required: Array<{ typeA: string; typeB: string; typeATrend: 'up' | 'down'; typeBTrend: 'up' | 'down' }>
  ownerMessage: (catName: string) => string
  vetNote: string
}

const CLUSTERS: ClusterSpec[] = [
  {
    name: 'kidney / thyroid / diabetes cluster',
    required: [
      { typeA: 'water', typeB: 'weight', typeATrend: 'up', typeBTrend: 'down' },
      { typeA: 'vomiting', typeB: 'weight', typeATrend: 'up', typeBTrend: 'down' },
    ],
    ownerMessage: (catName) =>
      `${catName} shows two separate patterns — increased water intake and more frequent vomiting, both alongside weight loss. Together these form a recognizable cluster strongly associated with kidney disease, thyroid issues, and diabetes in cats. A vet visit is strongly recommended.`,
    vetNote:
      `Multi-pattern cluster: concurrent PU/PD and increased vomiting frequency with weight loss. R/O CKD (BUN/Cr/UA), hyperthyroidism (T4), DM (glucose/fructosamine). High diagnostic yield.`,
  },
  {
    name: 'systemic illness cluster',
    required: [
      { typeA: 'food', typeB: 'weight', typeATrend: 'down', typeBTrend: 'down' },
      { typeA: 'grooming', typeB: 'weight', typeATrend: 'down', typeBTrend: 'down' },
    ],
    ownerMessage: (catName) =>
      `${catName}'s food intake and grooming have both declined while weight has dropped — when multiple things change together, that's a stronger signal than any one alone. This pattern often means a cat isn't feeling well systemically. A vet checkup is a good idea.`,
    vetNote:
      `Multi-pattern cluster: concurrent food intake decline, reduced grooming, and weight loss. Suggests systemic illness with pain or nausea component. Recommend full physical exam and bloodwork.`,
  },
]

export function detectConfluence(results: CorrelationResult[], catName: string): ConfluenceResult | null {
  for (const cluster of CLUSTERS) {
    const matched = cluster.required.every(({ typeA, typeB, typeATrend, typeBTrend }) => {
      const hit = results.find((r) => r.typeA === typeA && r.typeB === typeB)
      return hit && hit.strength !== 'none' && hit.typeATrend === typeATrend && hit.typeBTrend === typeBTrend
    })
    if (matched) {
      return {
        clusterName: cluster.name,
        pairKeys: cluster.required.map(({ typeA, typeB }) => `${typeA}→${typeB}`),
        ownerMessage: cluster.ownerMessage(catName),
        vetNote: cluster.vetNote,
      }
    }
  }
  return null
}

// ─── Description generation ───────────────────────────────────────────────────

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

function buildVetDescription(result: CorrelationResult): string {
  const { typeA, typeB, lag, r, strength, isHyperthyroidismPattern, typeATrend, typeBTrend, dataWeeks } = result
  const statsStr = `r=${r.toFixed(2)}, lag=${lag}wk, ${dataWeeks}wk window`
  const strengthLabel = strength === 'notable' ? 'Notable' : 'Weak'
  const aLabel = TYPE_DISPLAY[typeA] ?? typeA
  const bLabel = TYPE_DISPLAY[typeB] ?? typeB
  const trendKey = `${typeATrend}→${typeBTrend}`

  if (isHyperthyroidismPattern) {
    return `Paradoxical polyphagia with weight loss (${statsStr}). R/O hyperthyroidism (T4), DM (glucose/fructosamine), intestinal lymphoma, EPI.`
  }

  const differentials: Record<string, Record<string, string>> = {
    'food→weight': {
      'down→down': 'Differential: dental disease, GI disease (IBD/pancreatitis), systemic illness (CKD, hepatic disease, neoplasia).',
      'up→down':   'Paradoxical polyphagia with weight loss. R/O hyperthyroidism (T4), DM (glucose/fructosamine), intestinal lymphoma.',
      'down→stable': 'Appetite decline without weight loss. Monitor; consider early dietary or GI workup.',
      'up→up':     'Concurrent intake and weight increase. Monitor for obesity trend.',
    },
    'water→weight': {
      'up→down':   'PU/PD with weight loss. R/O CKD (BUN/Cr/UA), hyperthyroidism (T4), DM (glucose/fructosamine). High diagnostic yield.',
      'up→stable': 'Increased water intake without weight loss. R/O early DM, stress polydipsia, early CKD.',
      'down→down': 'Concurrent reduced water intake and weight loss. Consider dehydration or anorexia.',
    },
    'grooming→weight': {
      'down→down': 'Reduced grooming with weight loss. Suggests pain, nausea, or systemic illness. Consider: dental disease, GI disease, orthopedic pain.',
      'up→down':   'Excessive grooming with weight loss. Consider: psychogenic alopecia, dermatological with metabolic stress.',
    },
    'activity→weight': {
      'down→down': 'Decreased activity with weight loss. Consider: pain (dental, orthopedic, visceral), systemic illness, neoplasia.',
      'up→down':   'Hyperactivity with weight loss. R/O hyperthyroidism (T4).',
    },
    'vomiting→weight': {
      'up→down':   'Progressive vomiting with weight loss. Differential: IBD, small-cell GI lymphoma, hyperthyroidism, food intolerance. Consider abdominal ultrasound; endoscopic biopsy if bloodwork unremarkable.',
      'up→stable': 'Increased vomiting without weight loss. R/O dietary intolerance, hairballs, gastritis.',
      'down→down': 'Concurrent decline in vomiting and weight. Consider reduced intake overall.',
    },
  }

  const pairKey = `${typeA}→${typeB}`
  const pairDiffs = differentials[pairKey]
  const differential = pairDiffs?.[trendKey] ?? pairDiffs?.['stable→stable'] ?? ''

  return `${strengthLabel} correlation between ${aLabel} and ${bLabel} (${statsStr}). ${differential}`.trim()
}

export function describeCorrelation(
  result: CorrelationResult,
  catName: string,
  sex?: string | null,
  mode: 'owner' | 'vet' = 'owner',
): string {
  if (mode === 'vet') return buildVetDescription(result)

  const { typeA, typeB, lag, strength, isHyperthyroidismPattern, typeATrend, typeBTrend, dataWeeks, isPredictive } = result
  const poss = possessive(sex)

  if (strength === 'none') {
    const a = TYPE_DISPLAY[typeA] ?? typeA
    const b = TYPE_DISPLAY[typeB] ?? typeB
    return `No strong pattern detected yet between ${a} and ${b}. Keep logging to see trends emerge.`
  }

  if (isHyperthyroidismPattern) {
    return `${catName} is eating more than usual but still losing weight — an unusual combination. This is one of the clearest signals for conditions like hyperthyroidism or early diabetes in cats. A vet visit is strongly recommended.`
  }

  // Confidence qualifier based on data and strength
  const weakCaveat = strength === 'weak'
    ? ` This is a ${dataWeeks >= 8 ? 'suggestive' : 'early'} pattern — keep logging to see if it continues.`
    : ''

  // Early-warning note when typeA shifted before typeB caught up
  const earlyWarning = isPredictive && lag > 0
    ? ` Your tracking caught this early — ${poss} ${TYPE_DISPLAY[typeA] ?? typeA} shifted about ${lag === 1 ? 'a week' : `${lag} weeks`} before weight followed.`
    : ''

  // ── food → weight ──────────────────────────────────────────────────────────
  if (typeA === 'food' && typeB === 'weight') {
    if (typeATrend === 'down' && typeBTrend === 'down') {
      const action = strength === 'notable'
        ? (dataWeeks >= 8 ? 'This is a well-established pattern — worth discussing with your vet.' : 'This is worth discussing with your vet.')
        : 'Worth mentioning at your next vet visit.'
      return `${catName}'s food intake and weight have both been declining.${earlyWarning} Sustained appetite loss with weight loss is one of the most common ways cats show something's off internally. ${action}${weakCaveat}`
    }
    if (typeATrend === 'up' && typeBTrend === 'up') {
      return `${catName}'s food intake and weight have both been trending up.${earlyWarning} If the weight gain seems faster than expected, it may be worth monitoring portions.${weakCaveat}`
    }
    if (typeATrend === 'stable' && typeBTrend === 'down') {
      return `${catName}'s weight has been declining despite relatively stable food intake — which can indicate muscle wasting or metabolic changes even when appetite seems normal. Worth mentioning to your vet.${weakCaveat}`
    }
    if (typeBTrend === 'down') {
      return `${catName}'s food and weight are moving in an unusual pattern.${earlyWarning} Weight loss alongside food changes is worth a vet conversation.${weakCaveat}`
    }
    return `${catName}'s food intake and ${TYPE_DISPLAY['weight']} tend to move together.${earlyWarning}${weakCaveat}`
  }

  // ── water → weight ────────────────────────────────────────────────────────
  if (typeA === 'water' && typeB === 'weight') {
    if (typeATrend === 'up' && typeBTrend === 'down') {
      return `${catName} has been drinking more than usual while losing weight at the same time.${earlyWarning} In cats, this combination is one of the most recognizable early signs of kidney disease or diabetes — conditions that respond well to early treatment. A vet visit soon is a good idea.${weakCaveat}`
    }
    if (typeATrend === 'up' && typeBTrend === 'stable') {
      return `${catName} has been drinking more than usual, though ${poss} weight has stayed stable so far. Increased water intake in cats is worth noting — it often precedes changes in weight. ${strength === 'notable' ? 'A vet checkup is a reasonable next step.' : 'Keep logging to see if weight follows.'}${weakCaveat}`
    }
    if (typeATrend === 'down' && typeBTrend === 'down') {
      return `${catName}'s water intake and weight have both been declining.${earlyWarning} Reduced drinking combined with weight loss may indicate dehydration or systemic illness — worth discussing with your vet.${weakCaveat}`
    }
    return `${catName}'s water intake and weight show a ${strength} relationship over ${dataWeeks} weeks.${earlyWarning}${weakCaveat}`
  }

  // ── grooming → weight ─────────────────────────────────────────────────────
  if (typeA === 'grooming' && typeB === 'weight') {
    if (typeATrend === 'down' && typeBTrend === 'down') {
      return `${catName}'s grooming has declined while ${poss} weight has been dropping.${earlyWarning} Cats are meticulous groomers — they typically groom less when they're in pain or not feeling well. This combination is worth a vet checkup.${weakCaveat}`
    }
    if (typeATrend === 'up' && typeBTrend === 'down') {
      return `${catName} has been grooming more than usual while losing weight — which can signal stress or a skin condition. Combined with weight loss, this is worth mentioning to your vet.${weakCaveat}`
    }
    return `${catName}'s grooming and weight show a ${strength} relationship.${earlyWarning}${weakCaveat}`
  }

  // ── activity → weight ─────────────────────────────────────────────────────
  if (typeA === 'activity' && typeB === 'weight') {
    if (typeATrend === 'down' && typeBTrend === 'down') {
      return `${catName} has been less active while also losing weight.${earlyWarning} Cats are good at hiding pain — decreased activity is often the first visible sign that something's off. Combined with weight loss, this is worth mentioning to your vet.${weakCaveat}`
    }
    if (typeATrend === 'up' && typeBTrend === 'down') {
      return `${catName} has been more active than usual while losing weight — an unusual combination that can indicate hyperthyroidism. This is worth a vet mention.${weakCaveat}`
    }
    if (typeBTrend === 'down') {
      return `${catName}'s activity and weight have both been changing.${earlyWarning} Declining activity with weight loss can indicate pain or systemic illness.${weakCaveat}`
    }
    return `${catName}'s activity and weight show a ${strength} relationship.${earlyWarning}${weakCaveat}`
  }

  // ── vomiting → weight ─────────────────────────────────────────────────────
  if (typeA === 'vomiting' && typeB === 'weight') {
    if (typeATrend === 'up' && typeBTrend === 'down') {
      const urgency = strength === 'notable' && dataWeeks >= 8
        ? 'A vet call is a good idea — this is a well-established pattern in the data.'
        : 'If this continues for more than a few weeks, it warrants a vet call.'
      return `${catName}'s vomiting frequency has been increasing while ${poss} weight has been dropping.${earlyWarning} In cats, chronic vomiting combined with weight loss often signals GI disease. ${urgency}${weakCaveat}`
    }
    if (typeATrend === 'up' && typeBTrend === 'stable') {
      return `${catName}'s vomiting has been increasing, though ${poss} weight has stayed stable so far. Frequent vomiting without weight loss may be hairballs or dietary, but is worth monitoring. ${strength === 'notable' ? 'A vet visit to rule out GI issues is reasonable.' : 'Keep logging to see if weight is affected.'}${weakCaveat}`
    }
    if (typeATrend === 'down' && typeBTrend === 'down') {
      return `${catName}'s vomiting has been decreasing while ${poss} weight has also declined — possibly indicating reduced food intake overall. Keep an eye on both and mention this pattern to your vet.${weakCaveat}`
    }
    return `${catName}'s vomiting frequency and weight show a ${strength} relationship.${earlyWarning}${weakCaveat}`
  }

  // ── Generic fallback ──────────────────────────────────────────────────────
  const a = TYPE_DISPLAY[typeA] ?? typeA
  const b = TYPE_DISPLAY[typeB] ?? typeB
  if (lag === 0) {
    return `${catName}'s ${a} and ${b} tend to move together — when one changes, the other often follows around the same time.${weakCaveat}`
  }
  const lagText = lag === 1 ? 'about a week' : `about ${lag} weeks`
  return `${catName}'s ${a} tends to change before ${poss} ${b} does — ${b} follows ${lagText} later. Watching ${a} can give you an early signal.${weakCaveat}`
}

// ─── Home badge ───────────────────────────────────────────────────────────────

export function getHomeBadge(results: CorrelationResult[]): string | null {
  const hit = results.find((r) => r.strength === 'notable' && r.isPredictive)
  if (!hit) return null
  const labels: Record<string, string> = {
    food: 'food intake', water: 'water intake', grooming: 'grooming', activity: 'activity', vomiting: 'vomiting',
  }
  const a = labels[hit.typeA] ?? hit.typeA
  return hit.typeATrend === 'down'
    ? `Drop in ${a} may affect weight soon`
    : `Change in ${a} may affect weight soon`
}
