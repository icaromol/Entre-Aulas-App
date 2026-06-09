import { useCallback, useEffect, useReducer, useRef } from 'react'

const TOTAL = 100
const LOCK_DELAY = 500
const EPSILON = 0.01

function distributeEqually(count: number): number[] {
  if (count === 0) return []
  if (count === 1) return [100]
  const base = Math.floor(TOTAL / count)
  const rem  = TOTAL % count
  return Array.from({ length: count }, (_, i) => base + (i < rem ? 1 : 0))
}

interface SliderState { id: string; value: number; locked: boolean }

function clamp(v: number) { return Math.max(0, Math.min(TOTAL, v)) }
function sumValues(arr: SliderState[]) { return arr.reduce((s, x) => s + x.value, 0) }

function adjustIntegers(unlocked: SliderState[], target: number): SliderState[] {
  if (unlocked.length === 0) return unlocked
  const floored = unlocked.map(s => ({ ...s, value: Math.floor(s.value) }))
  let diff = target - sumValues(floored)
  if (diff === 0) return floored
  const indexed = floored.map((s, i) => ({ ...s, i }))
  if (diff > 0) {
    indexed.sort((a, b) => a.value - b.value || a.i - b.i)
    for (const s of indexed) { if (diff <= 0) break; s.value += 1; diff-- }
  } else {
    indexed.sort((a, b) => b.value - a.value || a.i - b.i)
    for (const s of indexed) { if (diff >= 0) break; if (s.value > 0) { s.value -= 1; diff++ } }
  }
  indexed.sort((a, b) => a.i - b.i)
  return indexed.map(({ i: _i, ...s }) => s)
}

function redistribute(sliders: SliderState[]): SliderState[] {
  const locked   = sliders.filter(s => s.locked)
  const unlocked = sliders.filter(s => !s.locked)
  if (unlocked.length === 0) return sliders
  const lockedTotal = sumValues(locked)
  const remaining   = Math.max(0, TOTAL - lockedTotal)
  const perItem     = remaining / unlocked.length
  const draft = sliders.map(s => s.locked ? s : { ...s, value: Math.max(0, perItem) })
  const adjUnlocked = adjustIntegers(draft.filter(s => !s.locked), remaining)
  return draft.map(s => {
    if (s.locked) return s
    return adjUnlocked.find(u => u.id === s.id) ?? s
  })
}

const forceReducer = (n: number) => n + 1

export interface ProportionalSliderItem { id: string; defaultValue?: number }

export interface UseProportionalSlidersResult {
  values: SliderState[]
  getValue: (id: string) => number
  isLocked: (id: string) => boolean
  handleChange: (id: string, newValue: number) => void
  reset: () => void
}

export function useProportionalSliders(
  items: ProportionalSliderItem[],
  onValuesChange?: (values: Array<{ id: string; value: number }>) => void,
): UseProportionalSlidersResult {
  const defaults = distributeEqually(items.length)
  const ref = useRef<SliderState[]>(
    items.map((item, i) => ({
      id: item.id,
      value: item.defaultValue ?? defaults[i] ?? 0,
      locked: false,
    }))
  )
  const [, forceUpdate] = useReducer(forceReducer, 0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reinicializa quando os IDs mudam (programa adicionado/removido)
  useEffect(() => {
    const curIds = ref.current.map(s => s.id).sort().join(',')
    const newIds = items.map(i => i.id).sort().join(',')
    if (curIds !== newIds) {
      const eq = distributeEqually(items.length)
      ref.current = items.map((item, i) => ({
        id: item.id,
        value: eq[i] ?? 0,
        locked: false,
      }))
      forceUpdate()
      onValuesChange?.(ref.current.map(s => ({ id: s.id, value: s.value })))
    }
  }, [items, onValuesChange])

  const getValue = useCallback((id: string) => ref.current.find(s => s.id === id)?.value ?? 0, [])
  const isLocked = useCallback((id: string) => ref.current.find(s => s.id === id)?.locked ?? false, [])

  const handleChange = useCallback((id: string, newValue: number) => {
    if (timerRef.current) clearTimeout(timerRef.current)

    // Trava o slider arrastado e redistribui imediatamente
    let next = ref.current.map(s =>
      s.id === id ? { ...s, value: clamp(newValue), locked: true } : s
    )

    // Se todos ficaram travados ou locked > 100%, reseta os locks
    const locked      = next.filter(s => s.locked)
    const unlocked    = next.filter(s => !s.locked)
    const lockedTotal = sumValues(locked)
    const impossible  =
      (lockedTotal > TOTAL && unlocked.length > 0) ||
      (unlocked.length === 0 && Math.abs(lockedTotal - TOTAL) > EPSILON)

    if (impossible) {
      next = next.map(s => ({ ...s, locked: s.id === id }))
    }

    // Redistribui imediatamente
    ref.current = redistribute(next)

    // Re-render imediato + notifica a página
    forceUpdate()
    onValuesChange?.(ref.current.map(s => ({ id: s.id, value: s.value })))

    // Timer só para desbloquear após inatividade
    timerRef.current = setTimeout(() => {
      ref.current = ref.current.map(s => ({ ...s, locked: false }))
      forceUpdate()
    }, LOCK_DELAY)
  }, [onValuesChange])

  // Reset sempre distribui igualmente, ignora defaultValue
  const reset = useCallback(() => {
    const eq = distributeEqually(items.length)
    ref.current = items.map((item, i) => ({
      id: item.id,
      value: eq[i] ?? 0,
      locked: false,
    }))
    forceUpdate()
    onValuesChange?.(ref.current.map(s => ({ id: s.id, value: s.value })))
  }, [items, onValuesChange])

  return { values: ref.current, getValue, isLocked, handleChange, reset }
}
