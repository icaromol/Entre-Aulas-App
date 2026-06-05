import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'

interface Student {
  id: string
  first_name: string
  last_name: string
  instrument: string
  level: string
  status: string
}

export default function StudentsPage() {
  const { profile } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

const location = useLocation()
const inviteLink = location.state?.inviteLink as string | undefined
const inviteStudentName = location.state?.studentName as string | undefined
const [copied, setCopied] = useState(false)

function handleCopy() {
  if (!inviteLink) return
  navigator.clipboard.writeText(inviteLink)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}

  useEffect(() => {
    if (profile) fetchStudents()
  }, [profile])

  async function fetchStudents() {
    const { data } = await supabase
      .from('students')
      .select('id, first_name, last_name, instrument, level, status')
      .eq('status', 'active')
      .order('first_name')

    setStudents(data ?? [])
    setLoading(false)
  }

  const levelLabel: Record<string, string> = {
    beginner: 'Iniciante',
    intermediate: 'Intermediário',
    advanced: 'Avançado',
  }

  return (
    <TeacherLayout>
      {/* Banner de convite */}
{inviteLink && (
  <div className="bg-[#D6E4F0] border border-[#4A90C4]/30 rounded-2xl p-4 mb-5">
    <p className="text-sm font-semibold text-[#1E3A5F] mb-1">
      ✅ {inviteStudentName} cadastrado!
    </p>
    <p className="text-xs text-[#1E3A5F]/70 mb-3">
      Compartilhe o link abaixo com o aluno para ele criar a senha de acesso.
    </p>
    <div className="flex gap-2">
      <input
        readOnly
        value={inviteLink}
        className="flex-1 px-3 py-2 rounded-lg border border-[#4A90C4]/30 bg-white text-xs text-gray-600 outline-none"
      />
      <button
        onClick={handleCopy}
        className="px-4 py-2 rounded-lg bg-[#1E3A5F] text-white text-xs font-medium hover:bg-[#1E3A5F]/90 transition whitespace-nowrap"
      >
        {copied ? '✓ Copiado!' : 'Copiar'}
      </button>
    </div>
  </div>
)}
      {/* Cabeçalho da página */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#1E3A5F]">Alunos</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {students.length} {students.length === 1 ? 'aluno ativo' : 'alunos ativos'}
          </p>
        </div>
        <Link to="/professor/alunos/novo">
          <Button className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-sm">
            + Novo aluno
          </Button>
        </Link>
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">Nenhum aluno cadastrado ainda.</p>
          <Link to="/professor/alunos/novo">
            <Button className="mt-4 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-sm">
              Cadastrar primeiro aluno
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {students.map(student => (
            <Link
              key={student.id}
              to={`/professor/alunos/${student.id}`}
              className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-between hover:border-[#4A90C4] transition"
            >
              <div className="flex items-center gap-4">
                {/* Avatar inicial */}
                <div className="w-10 h-10 rounded-full bg-[#D6E4F0] flex items-center justify-center text-[#1E3A5F] font-semibold text-sm">
                  {student.first_name[0]}{student.last_name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {student.first_name} {student.last_name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {student.instrument} · {levelLabel[student.level] ?? student.level}
                  </p>
                </div>
              </div>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" strokeWidth={2}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </Link>
          ))}
        </div>
      )}
    </TeacherLayout>
  )
}