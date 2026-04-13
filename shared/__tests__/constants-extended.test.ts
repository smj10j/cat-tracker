import { describe, it, expect } from 'vitest'
import {
  VALID_MEASUREMENT_TYPES,
  MEASUREMENT_TYPE_LABELS,
  MEASUREMENT_TYPE_LABELS_LONG,
  BEHAVIORAL_TYPES,
  BEHAVIORAL_TYPE_SET,
  BEHAVIOR_CHART_TYPES,
  CHART_LINE_COLORS,
} from '../lib/constants'

describe('MEASUREMENT_TYPE_LABELS', () => {
  it('has labels for all valid measurement types', () => {
    for (const type of VALID_MEASUREMENT_TYPES) {
      expect(MEASUREMENT_TYPE_LABELS[type]).toBeTruthy()
    }
  })

  it('includes legacy play type', () => {
    expect(MEASUREMENT_TYPE_LABELS.play).toBe('Play')
  })
})

describe('MEASUREMENT_TYPE_LABELS_LONG', () => {
  it('extends short labels with longer food/water text', () => {
    expect(MEASUREMENT_TYPE_LABELS_LONG.food).toBe('Food Intake')
    expect(MEASUREMENT_TYPE_LABELS_LONG.water).toBe('Water Intake')
  })

  it('preserves other labels from short version', () => {
    expect(MEASUREMENT_TYPE_LABELS_LONG.weight).toBe('Weight')
    expect(MEASUREMENT_TYPE_LABELS_LONG.grooming).toBe('Grooming')
  })
})

describe('BEHAVIORAL_TYPES', () => {
  it('has 6 behavioral types', () => {
    expect(BEHAVIORAL_TYPES).toHaveLength(6)
  })

  it('each entry has key and label', () => {
    for (const t of BEHAVIORAL_TYPES) {
      expect(t.key).toBeTruthy()
      expect(t.label).toBeTruthy()
    }
  })

  it('keys match BEHAVIORAL_TYPE_SET', () => {
    for (const t of BEHAVIORAL_TYPES) {
      expect(BEHAVIORAL_TYPE_SET.has(t.key)).toBe(true)
    }
  })
})

describe('BEHAVIOR_CHART_TYPES', () => {
  it('includes grooming, activity, vomiting, litter, play', () => {
    expect(BEHAVIOR_CHART_TYPES.has('grooming')).toBe(true)
    expect(BEHAVIOR_CHART_TYPES.has('activity')).toBe(true)
    expect(BEHAVIOR_CHART_TYPES.has('vomiting')).toBe(true)
    expect(BEHAVIOR_CHART_TYPES.has('litter')).toBe(true)
    expect(BEHAVIOR_CHART_TYPES.has('play')).toBe(true)
  })

  it('excludes food and water (they have own chart tabs)', () => {
    expect(BEHAVIOR_CHART_TYPES.has('food')).toBe(false)
    expect(BEHAVIOR_CHART_TYPES.has('water')).toBe(false)
  })

  it('excludes weight', () => {
    expect(BEHAVIOR_CHART_TYPES.has('weight')).toBe(false)
  })
})

describe('CHART_LINE_COLORS', () => {
  it('has 6 colors', () => {
    expect(CHART_LINE_COLORS).toHaveLength(6)
  })

  it('all are hex color strings', () => {
    for (const c of CHART_LINE_COLORS) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('first color is lavender (brand)', () => {
    expect(CHART_LINE_COLORS[0]).toBe('#c084fc')
  })
})
