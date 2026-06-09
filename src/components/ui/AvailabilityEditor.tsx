import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MdAccessTime, MdCheckCircle, MdEdit } from 'react-icons/md'
import { supabase } from '@/lib/supabase'

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const AVAIL_MIN = 5, AVAIL_MAX = 720

function toSliderPos(m: number) {
  return Math.round(Math.log(m / AVAIL_MIN) / Math.log(AVAIL_MAX / AVAIL_MIN) * 100)
}
function fromSliderPos(p: number) {
  return Math.max(AVAIL_MIN, Math.round(AVAIL_MIN * Math.pow(AVAIL_MAX / AVAIL_MIN, p / 100) / 5) * 5)
}
function fmtMin(m: number) {
  const h = Math.floor(m / 60), r = m % 60
  return m < 60 ? `${m}min` : r === 0 ? `${h}h` : `${h}h${r}min`
}

export interface DayAvail { day: number; active: boolean; minutes: number }

export function defaultAvail(): DayAvail[] {
  return DAYS.map((_, i) => ({ day: i, active: false, minutes: 30 }))
}

interface Props {
  studentId: string
  onSaved?: (hasAny: boolean) => void
  onLoaded?: (hasAny: boolean) => void
}

export function AvailabilityEditor({ studentId, onSaved, onLoaded }: Props) {
  const [availability, setAvailability] = useState<DayAvail[]>(defaultAvail())
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('student_availability')
      .select('*')
      .eq('student_id', studentId)
      .order('day_of_week')
    const loaded = data && data.length > 0
      ? DAYS.map((_, i) => {
          const found = data.find((d: { day_of_week: number }) => d.day_of_week === i)
          return { day: i, active: found?.is_active ?? false, minutes: found?.minutes_available ?? 30 }
        })
      : defaultAvail()
    const hasAny = loaded.some(d => d.active)
    setAvailability(loaded)
    if (!hasAny) setExpanded(true)
    setLoaded(true)
    onLoaded?.(hasAny)
  }, [studentId, onLoaded])

  useEffect(() => { load() }, [load])

  const hasAny = availability.some(d => d.active)

  function toggleDay(day: number) {
    setAvailability(prev => prev.map(d => d.day === day ? { ...d, active: !d.active } : d))
  }

  function setMinutes(day: number, minutes: number) {
    setAvailability(prev => prev.map(d => d.day === day ? { ...d, minutes } : d))
  }

  async function handleSave() {
    setSaving(true)
    const { error: delErr } = await supabase
      .from('student_availability').delete().eq('student_id', studentId)
    if (delErr) {
      toast.error(`Erro ao salvar: ${delErr.message}`)
      setSaving(false)
      return
    }
    const { error: insErr } = await supabase.from('student_availability').insert(
      availability.map(d => ({
        student_id: studentId,
        day_of_week: d.day,
        is_active: d.active,
        minutes_available: d.active ? d.minutes : null,
      }))
    )
    if (insErr) {
      toast.error(`Erro ao salvar: ${insErr.message}`)
      setSaving(false)
      return
    }
    toast.success('Disponibilidade salva!')
    setExpanded(false)
    onSaved?.(availability.some(d => d.active))
    setSaving(false)
  }

  if (!loaded) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
          <MdAccessTime size={15} /> Dias disponíveis
        </h2>
        {hasAny && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1 text-xs text-[#4A90C4] hover:text-[#1E3A5F] transition"
          >
            <MdEdit size={13} /> Editar
          </button>
        )}
        {hasAny && !expanded && (
          <MdCheckCircle size={18} className="text-green-500 ml-auto" />
        )}
      </div>

      {expanded && (
        <div className="space-y-3">
          <div className="space-y-2">
            {availability.map(day => (
              <div key={day.day} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleDay(day.day)}
                  className={`w-12 text-xs font-semibold py-1.5 rounded-lg border transition ${
                    day.active
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-white text-gray-400 border-gray-200'
                  }`}
                >
                  {DAYS[day.day]}
                </button>
                {day.active && (
                  <div className="flex items-center gap-3 flex-1">
                    <input
                      type="range" min={0} max={100} step={1}
                      value={toSliderPos(day.minutes)}
                      onChange={e => setMinutes(day.day, fromSliderPos(Number(e.target.value)))}
                      className="flex-1 accent-[#1E3A5F]"
                    />
                    <span className="text-xs font-bold text-[#1E3A5F] w-14 text-right shrink-0">
                      {fmtMin(day.minutes)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 rounded-xl bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#1E3A5F]/90 transition disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar dias'}
          </button>
        </div>
      )}
    </div>
  )
}
