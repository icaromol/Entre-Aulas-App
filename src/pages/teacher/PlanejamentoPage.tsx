import { useParams, useNavigate } from 'react-router-dom'
import { MdArrowBack, MdAutoAwesome } from 'react-icons/md'
import { TeacherLayout } from '@/components/layout/TeacherLayout'
import { Button } from '@/components/ui/button'

export default function PlanejamentoPage() {
  const { studentId } = useParams()
  const navigate = useNavigate()

  return (
    <TeacherLayout>
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate(`/professor/alunos/${studentId}?tab=programs`)}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <MdArrowBack size={20} />
        </button>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Planejamento de Estudos</h1>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#D6E4F0] flex items-center justify-center mb-4">
          <MdAutoAwesome size={28} className="text-[#1E3A5F]" />
        </div>
        <p className="text-base font-bold text-[#1E3A5F] mb-2">Geração automática</p>
        <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
          O algoritmo de geração está em desenvolvimento. Em breve você poderá gerar o plano de estudos automaticamente a partir dos programas do aluno.
        </p>
        <Button
          onClick={() => navigate(`/professor/alunos/${studentId}?tab=programs`)}
          className="mt-6 bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white rounded-xl px-8"
        >
          Voltar aos programas
        </Button>
      </div>
    </TeacherLayout>
  )
}
