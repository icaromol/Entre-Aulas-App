import { useEffect, useRef, useState } from 'react'

interface PillSliderProps {
  value: number
  min?: number
  max?: number
  labels?: string[]
  onChange: (v: number) => void
}

const STIFFNESS = 420
const DAMPING = 0.65
const PADDING = 4  // px

export function PillSlider({ value, min = 1, max = 4, labels, onChange }: PillSliderProps) {
  const count = max - min + 1
  const trackRef = useRef<HTMLDivElement>(null)
  const [trackWidth, setTrackWidth] = useState(0)  // offsetWidth (inclui padding)
  const [indicatorX, setIndicatorX] = useState(0)

  const posRef = useRef(0)
  const velRef = useRef(0)
  const rafRef = useRef(0)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartPx = useRef(0)

  // Cada slot ocupa (offsetWidth - 2*PADDING) / count, começando em PADDING
  function indicatorW(tw: number) {
    return (tw - PADDING * 2) / count
  }

  function targetX(v: number, tw: number) {
    return PADDING + (v - min) * indicatorW(tw)
  }

  function snapTo(px: number, tw: number) {
    const iw = indicatorW(tw)
    let best = min, bestDist = Infinity
    for (let n = min; n <= max; n++) {
      const cx = PADDING + (n - min) * iw + iw / 2
      const dist = Math.abs(px - cx)
      if (dist < bestDist) { bestDist = dist; best = n }
    }
    return best
  }

  function springTo(target: number) {
    cancelAnimationFrame(rafRef.current)
    let lastTime = performance.now()
    function step(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now
      velRef.current += (target - posRef.current) * STIFFNESS * dt
      velRef.current *= Math.pow(DAMPING, dt * 60)
      posRef.current += velRef.current * dt
      setIndicatorX(posRef.current)
      if (Math.abs(target - posRef.current) > 0.3 || Math.abs(velRef.current) > 0.3) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        posRef.current = target
        setIndicatorX(target)
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = el.offsetWidth  // inclui padding — alinha com o posicionamento absoluto
      setTrackWidth(w)
      const tx = targetX(value, w)
      posRef.current = tx
      velRef.current = 0
      setIndicatorX(tx)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (trackWidth === 0 || isDragging.current) return
    springTo(targetX(value, trackWidth))
  }, [value, trackWidth])

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartPx.current = posRef.current
    cancelAnimationFrame(rafRef.current)
    velRef.current = 0
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current || trackWidth === 0) return
    const iw = indicatorW(trackWidth)
    const delta = e.clientX - dragStartX.current
    const newPx = Math.max(PADDING, Math.min(PADDING + (count - 1) * iw, dragStartPx.current + delta))
    posRef.current = newPx
    setIndicatorX(newPx)
  }

  function handlePointerUp() {
    if (!isDragging.current) return
    isDragging.current = false
    const iw = indicatorW(trackWidth)
    const centerX = posRef.current + iw / 2
    const snapped = snapTo(centerX, trackWidth)
    onChange(snapped)
    springTo(targetX(snapped, trackWidth))
  }

  function handleTrackClick(e: React.MouseEvent<HTMLDivElement>) {
    if (isDragging.current) return
    const rect = trackRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const snapped = snapTo(x, trackWidth)
    onChange(snapped)
  }

  const iw = trackWidth > 0 ? indicatorW(trackWidth) : 0
  const items = Array.from({ length: count }, (_, i) => min + i)

  return (
    <div
      ref={trackRef}
      onClick={handleTrackClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative flex bg-gray-100 rounded-xl cursor-grab active:cursor-grabbing select-none"
      style={{ touchAction: 'none', padding: PADDING }}
    >
      {iw > 0 && (
        <div
          className="absolute rounded-lg bg-white z-0"
          style={{
            left: indicatorX,
            top: PADDING,
            bottom: PADDING,
            width: iw,
            willChange: 'left',
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
          }}
        />
      )}
      {items.map((n, i) => (
        <div
          key={n}
          className={`relative z-10 flex-1 py-2 text-center text-xs font-semibold transition-colors duration-150 pointer-events-none ${
            value === n ? 'text-[#1E3A5F]' : 'text-gray-500'
          }`}
        >
          {labels ? labels[i] : n}
        </div>
      ))}
    </div>
  )
}
