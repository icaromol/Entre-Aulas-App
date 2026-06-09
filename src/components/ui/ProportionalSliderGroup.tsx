import { useCallback } from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { MdBalance, MdLock } from 'react-icons/md'
import { useProportionalSliders, type ProportionalSliderItem } from '@/hooks/useProportionalSliders'

interface SliderItemDef {
  id: string
  label: string
  defaultValue?: number
}

interface Props {
  items: SliderItemDef[]
  onChange: (id: string, value: number) => void
}

function SingleSlider({
  id, label, value, locked, onChange,
}: {
  id: string
  label: string
  value: number
  locked: boolean
  onChange: (id: string, v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 truncate mr-2">{label}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {locked && <MdLock size={11} className="text-[#4A90C4]" />}
          <input
            type="number" min={0} max={100}
            value={value}
            onChange={e => {
              const v = Math.max(0, Math.min(100, Number(e.target.value) || 0))
              onChange(id, v)
            }}
            className="w-12 text-center text-xs border border-gray-200 rounded-lg px-1 py-1 outline-none focus:border-[#4A90C4] transition"
          />
          <span className="text-xs text-gray-400">%</span>
        </div>
      </div>
      <SliderPrimitive.Root
        value={[value]}
        onValueChange={([v]) => onChange(id, v ?? value)}
        min={0} max={100} step={1}
        className="relative flex items-center w-full h-5 select-none touch-none"
      >
        <SliderPrimitive.Track className="relative h-1.5 flex-1 rounded-full bg-gray-200 overflow-hidden">
          <SliderPrimitive.Range className="absolute h-full bg-[#4A90C4] rounded-full" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block w-4 h-4 rounded-full bg-[#1E3A5F] shadow focus:outline-none focus:ring-2 focus:ring-[#4A90C4]/40 transition" />
      </SliderPrimitive.Root>
    </div>
  )
}

export function ProportionalSliderGroup({ items, onChange }: Props) {
  const proportionalItems: ProportionalSliderItem[] = items.map(item => ({
    id: item.id,
    defaultValue: item.defaultValue,
  }))

  const handleValuesChange = useCallback(
    (vals: Array<{ id: string; value: number }>) => {
      for (const { id, value } of vals) onChange(id, value)
    },
    [onChange]
  )

  const sliders = useProportionalSliders(proportionalItems, handleValuesChange)

  if (items.length <= 1) return null

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map(item => {
          const state = sliders.values.find(v => v.id === item.id)
          return (
            <SingleSlider
              key={item.id}
              id={item.id}
              label={item.label}
              value={state?.value ?? 0}
              locked={state?.locked ?? false}
              onChange={sliders.handleChange}
            />
          )
        })}
      </div>

      <div className="flex items-center pt-1">
        <button
          type="button"
          onClick={sliders.reset}
          className="flex items-center gap-1 text-xs text-[#4A90C4] hover:text-[#1E3A5F] transition"
        >
          <MdBalance size={13} /> Auto-balancear
        </button>
      </div>
    </div>
  )
}
