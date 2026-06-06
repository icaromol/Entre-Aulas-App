import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { MdAdd, MdChevronRight, MdEdit } from 'react-icons/md'
import Avatar from 'boring-avatars'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'

const AVATAR_COLORS = ['#1E3A5F', '#4A90C4', '#D6E4F0', '#F5F7FA', '#FFFFFF']

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
  const navigate = useNavigate()
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

      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#1E3A5F]">Alunos</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {students.length} {students.length === 1 ? 'aluno ativo' : 'alunos ativos'}
          </p>
        </div>
        <Link to="/professor/alunos/novo">
          <Button className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-sm">
            <MdAdd size={16} className="inline -mt-0.5 mr-0.5" />Novo aluno
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
            <div
              key={student.id}
              className="bg-white rounded-2xl border border-gray-100 hover:border-[#4A90C4] transition px-5 py-4 flex items-center gap-4"
            >
              {/* Área clicável → perfil */}
              <Link
                to={`/professor/alunos/${student.id}`}
                className="flex items-center gap-4 flex-1 min-w-0"
              >
                <div className="shrink-0 rounded-full overflow-hidden">
                  <Avatar
                    size={40}
                    name={`${student.first_name} ${student.last_name}`}
                    variant="beam"
                    colors={AVATAR_COLORS}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {student.first_name} {student.last_name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {student.instrument} · {levelLabel[student.level] ?? student.level}
                  </p>
                </div>
              </Link>

              {/* Ações inline + chevron */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => navigate(`/professor/alunos/${student.id}/plano`)}
                  className="w-8 h-8 rounded-lg bg-[#D6E4F0] text-[#1E3A5F] hover:bg-[#4A90C4] hover:text-white transition flex items-center justify-center"
                  title="Criar plano"
                >
                  <MdAdd size={16} />
                </button>
                <button
                  onClick={() => navigate(`/professor/alunos/${student.id}/editar`)}
                  className="w-8 h-8 rounded-lg text-gray-400 hover:text-[#4A90C4] hover:bg-gray-100 transition flex items-center justify-center"
                  title="Editar aluno"
                >
                  <MdEdit size={16} />
                </button>
                <MdChevronRight size={16} className="text-gray-300" />
              </div>
            </div>
          ))}
        </div>
      )}
    </TeacherLayout>
  )
}
