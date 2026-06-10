import { useState } from "react"
import { MdClose } from "react-icons/md"

const AVAIL_MIN = 5, AVAIL_MAX = 720

function toSliderPos(m: number) {
  return Math.round(Math.log(m / AVAIL_MIN) / Math.log(AVAIL_MAX / AVAIL_MIN) * 100)
}
function fromSliderPos(p: number) {
  return Math.max(AVAIL_MIN, Math.round(AVAIL_MIN * Math.pow(AVAIL_MAX / AVAIL_MIN, p / 100) / 5) * 5)
}
function fmtMin(m: number) {
  const h = Math.floor(m / 60), r = m % 60
  return m < 60 ? `${m} min` : r === 0 ? `${h}h` : `${h}h ${r}min`
}

interface Props {
  onClose: () => void
  currentMinutes: number
  onConfirm: (newMinutes: number) => void
}

export function ChangeTimeModal({ onClose, currentMinutes, onConfirm }: Props) {
  const [sliderPos, setSliderPos] = useState(toSliderPos(Math.max(AVAIL_MIN, currentMinutes)))

  const selected = fromSliderPos(sliderPos)
  const unchanged = selected === currentMinutes

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 pb-8 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#1E3A5F]">Quanto tempo você tem hoje?</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition">
            <MdClose size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400">Plano atual: {fmtMin(currentMinutes)}</span>
          <span className={`text-lg font-bold transition ${unchanged ? "text-gray-400" : "text-[#1E3A5F]"}`}>
            {fmtMin(selected)}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={sliderPos}
          onChange={e => setSliderPos(Number(e.target.value))}
          className="w-full accent-[#1E3A5F] mb-6"
        />

        <button
          disabled={unchanged}
          onClick={() => onConfirm(selected)}
          className="w-full py-3 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold hover:bg-[#1E3A5F]/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Adaptar meu plano
        </button>
      </div>
    </div>
  )
}
