import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-[#D6E4F0] flex items-center justify-center mb-6">
        <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#1E3A5F" strokeWidth={1.5}>
          <path d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-[#1E3A5F] mb-2">Página não encontrada</h1>
      <p className="text-sm text-gray-400 mb-8 max-w-xs">
        O endereço que você tentou acessar não existe ou foi removido.
      </p>
      <button
        onClick={() => navigate(-1)}
        className="px-6 py-2.5 bg-[#1E3A5F] text-white text-sm font-medium rounded-xl hover:bg-[#1E3A5F]/90 transition"
      >
        Voltar
      </button>
    </div>
  )
}
