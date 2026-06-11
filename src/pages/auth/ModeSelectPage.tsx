import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdSchool, MdMusicNote, MdSwapHoriz } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useNextStep } from 'nextstepjs'
import { useOnboarding } from '@/hooks/useOnboarding'

export default function ModeSelectPage() {
  const { user, profile, setMode } = useAuth()
  const navigate = useNavigate()
  const [activating, setActivating] = useState(false)
  const { startNextStep } = useNextStep()
  const { progress, loading } = useOnboarding()

  useEffect(() => {
    if (loading || progress.tour_mode_select_seen) return
    // só para professores — alunos puros não veem essa tela
    if (profile?.role !== 'teacher') return
    const id = setTimeout(() => startNextStep('tour_mode_select'), 600)
    return () => clearTimeout(id)
  }, [loading, progress.tour_mode_select_seen, profile?.role, startNextStep])

  async function handleTeacher() {
    setMode('teacher')
    navigate('/professor/jornada', { replace: true })
  }

  async function handleStudent() {
    setMode('student')
    navigate('/aluno/planejamento', { replace: true })
  }

  async function handleActivatePersonal() {
    if (!user || !profile) return
    setActivating(true)
    await supabase.from('students').insert({
      profile_id:    user.id,
      teacher_id:    null,
      first_name:    profile.first_name,
      last_name:     profile.last_name,
      status:        'active',
    })
    setActivating(false)
    setMode('student')
    navigate('/aluno/planejamento', { replace: true })
  }

  const hasPersonalArea = profile?.studentId !== null

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Bom dia' :
    hour < 18 ? 'Boa tarde' :
                'Boa noite'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <img src="/estudamus_logo.png" alt="estudamus" className="h-8 mb-10 opacity-90" />

      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold text-[#1E3A5F] text-center mb-1">
          {greeting}, {profile?.first_name}!
        </h1>
        <p className="text-sm text-gray-400 text-center mb-8">
          Vai dar aula ou colocar o estudo em dia?
        </p>

        <div id="mode-select-cards" className="grid grid-cols-2 gap-4">
          {/* Área de professor */}
          <button
            onClick={handleTeacher}
            className="flex flex-col items-center gap-3 p-6 bg-white rounded-2xl border-2 border-gray-100 hover:border-[#1E3A5F] hover:shadow-md transition group"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#D6E4F0] flex items-center justify-center group-hover:bg-[#1E3A5F] transition">
              <MdSchool size={28} className="text-[#1E3A5F] group-hover:text-white transition" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-[#1E3A5F]">Dar aula</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-tight">Gerenciar alunos e repertório</p>
            </div>
          </button>

          {/* Área pessoal */}
          {hasPersonalArea ? (
            <button
              onClick={handleStudent}
              className="flex flex-col items-center gap-3 p-6 bg-white rounded-2xl border-2 border-gray-100 hover:border-[#4A90C4] hover:shadow-md transition group"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#D6E4F0] flex items-center justify-center group-hover:bg-[#4A90C4] transition">
                <MdMusicNote size={28} className="text-[#1E3A5F] group-hover:text-white transition" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-[#1E3A5F]">Estudar</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">Praticar e planejar seu repertório</p>
              </div>
            </button>
          ) : (
            <button
              onClick={handleActivatePersonal}
              disabled={activating}
              className="flex flex-col items-center gap-3 p-6 bg-white rounded-2xl border-2 border-gray-100 hover:border-[#4A90C4] hover:shadow-md transition group disabled:opacity-50"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#D6E4F0] flex items-center justify-center group-hover:bg-[#4A90C4] transition">
                <MdMusicNote size={28} className="text-[#1E3A5F] group-hover:text-white transition" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-[#1E3A5F]">
                  {activating ? 'Ativando...' : 'Estudar'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">Praticar e planejar seu repertório</p>
              </div>
            </button>
          )}
        </div>

        {/* Hint de troca de modo */}
        <div id="mode-select-switch-hint" className="flex items-center gap-2.5 mt-6 px-4 py-3 bg-white rounded-2xl border border-gray-100">
          <div className="w-7 h-7 rounded-full bg-[#D6E4F0] flex items-center justify-center shrink-0">
            <MdSwapHoriz size={16} className="text-[#1E3A5F]" />
          </div>
          <p className="text-xs text-gray-400 leading-snug">
            Pode trocar de modo a qualquer hora pelo{' '}
            <span className="font-semibold text-[#1E3A5F]">menu</span> dentro do app.
          </p>
        </div>
      </div>
    </div>
  )
}
