import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

export default function TeacherPage() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#153b50]">
              Olá, {profile?.first_name} 👋
            </h1>
            <p className="text-sm text-gray-500 mt-1">Painel do professor</p>
          </div>
          <Button
            onClick={signOut}
            variant="outline"
            className="text-sm"
          >
            Sair
          </Button>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
          Em construção — painel do professor
        </div>
      </div>
    </div>
  )
}