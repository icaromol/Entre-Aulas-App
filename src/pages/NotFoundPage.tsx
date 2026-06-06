import { useNavigate } from 'react-router-dom'
import { MdMusicOff, MdArrowBack, MdHome } from 'react-icons/md'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-[#D6E4F0] flex items-center justify-center mb-6">
        <MdMusicOff size={40} className="text-[#1E3A5F]" />
      </div>

      <p className="text-5xl font-bold text-[#1E3A5F] mb-2">404</p>
      <h1 className="text-lg font-semibold text-gray-700 mb-2">Página não encontrada</h1>
      <p className="text-sm text-gray-400 mb-8 max-w-xs leading-relaxed">
        O endereço que você tentou acessar não existe ou foi removido.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#1E3A5F] text-white text-sm font-medium rounded-xl hover:bg-[#1E3A5F]/90 transition"
        >
          <MdArrowBack size={16} />
          Voltar
        </button>
        <button
          onClick={() => navigate('/login')}
          className="flex items-center justify-center gap-2 px-6 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:border-[#4A90C4] transition"
        >
          <MdHome size={16} />
          Ir para o início
        </button>
      </div>
    </div>
  )
}
