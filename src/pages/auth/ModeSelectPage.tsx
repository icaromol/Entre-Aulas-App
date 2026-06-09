import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdSchool, MdMusicNote } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export default function ModeSelectPage() {
  const { user, profile, setMode } = useAuth()
  const navigate = useNavigate()
  const [activating, setActivating] = useState(false)

  async function handleTeacher() {
    setMode('teacher')
    navigate('/professor/jornada', { replace: true })
  }

  async function handleStudent() {
    setMode('student')
    navigate('/aluno/hoje', { replace: true })
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
    navigate('/aluno/hoje', { replace: true })
  }

  const hasPersonalArea = profile?.studentId !== null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <img src="/estudamus_logo.png" alt="estudamus" className="h-8 mb-10 opacity-90" />

      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold text-[#1E3A5F] text-center mb-1">
          Olá, {profile?.first_name}!
        </h1>
        <p className="text-sm text-gray-400 text-center mb-8">Como quer entrar hoje?</p>

        <div className="grid grid-cols-2 gap-4">
          {/* Área de professor */}
          <button
            onClick={handleTeacher}
            className="flex flex-col items-center gap-3 p-6 bg-white rounded-2xl border-2 border-gray-100 hover:border-[#1E3A5F] hover:shadow-md transition group"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#D6E4F0] flex items-center justify-center group-hover:bg-[#1E3A5F] transition">
              <MdSchool size={28} className="text-[#1E3A5F] group-hover:text-white transition" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-[#1E3A5F]">Meus alunos</p>
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
                <p className="text-sm font-bold text-[#1E3A5F]">Meus estudos</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">Praticar e organizar repertório</p>
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
                  {activating ? 'Ativando...' : 'Meus estudos'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">Praticar e organizar repertório</p>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
