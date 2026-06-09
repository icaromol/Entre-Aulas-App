import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdSchool, MdLink, MdLogout } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

export default function StudentPendingPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [inviteUrl, setInviteUrl] = useState('')
  const [linking, setLinking] = useState(false)

  async function handleLinkInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    // Extrair invite token da URL colada
    let studentId: string | null = null
    let token: string | null = null
    try {
      const url = new URL(inviteUrl.trim())
      studentId = url.searchParams.get('invite')
      // Verificar se é uma URL de convite no formato /cadastro?invite=<studentId>
      // O token real fica em students.invite_token — buscamos pelo studentId
    } catch {
      toast.error('URL de convite inválida.')
      return
    }

    if (!studentId) {
      toast.error('URL de convite inválida. Verifique o link enviado pelo professor.')
      return
    }

    setLinking(true)

    // Buscar o token de invite desse student
    const { data: student, error: fetchErr } = await supabase
      .from('students')
      .select('id, invite_token, invite_expires_at, profile_id')
      .eq('id', studentId)
      .single()

    if (fetchErr || !student) {
      toast.error('Convite não encontrado.')
      setLinking(false)
      return
    }

    if (student.profile_id) {
      toast.error('Este convite já foi usado por outra conta.')
      setLinking(false)
      return
    }

    if (!student.invite_token) {
      toast.error('Este convite não é válido.')
      setLinking(false)
      return
    }

    if (student.invite_expires_at && new Date(student.invite_expires_at) < new Date()) {
      toast.error('Este convite expirou. Peça um novo link ao seu professor.')
      setLinking(false)
      return
    }

    token = student.invite_token

    const { error: updateErr } = await supabase
      .from('students')
      .update({ profile_id: user.id, invite_token: null })
      .eq('id', studentId)
      .eq('invite_token', token)
      .is('profile_id', null)

    if (updateErr) {
      toast.error('Erro ao vincular conta. Tente novamente.')
      setLinking(false)
      return
    }

    toast.success('Conta vinculada com sucesso!')
    // Recarregar para que useAuth recarregue o profile com o novo studentId
    window.location.replace('/aluno/hoje')
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100">
        <div className="px-4 h-14 flex items-center justify-center">
          <img src="/estudamus_logo.png" alt="estudamus" className="h-5" />
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-sm mx-auto w-full gap-8">

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#D6E4F0] flex items-center justify-center">
            <MdSchool size={32} color="#1E3A5F" />
          </div>
          <h1 className="text-xl font-bold text-[#1E3A5F]">Conta sem professor</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Você se cadastrou sem usar o link de convite do seu professor.
            Cole o link abaixo para vincular sua conta.
          </p>
        </div>

        <form onSubmit={handleLinkInvite} className="w-full space-y-3">
          <div>
            <label className="text-xs text-gray-400 font-medium">Link de convite do professor</label>
            <div className="relative mt-1">
              <MdLink size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="url"
                value={inviteUrl}
                onChange={e => setInviteUrl(e.target.value)}
                placeholder="https://entre-aulas-app.vercel.app/cadastro?invite=..."
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#4A90C4] transition"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={linking || !inviteUrl.trim()}
            className="w-full py-3 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold hover:bg-[#1E3A5F]/90 transition disabled:opacity-50"
          >
            {linking ? 'Vinculando...' : 'Vincular com professor'}
          </button>
        </form>

        <div className="w-full border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400 text-center mb-3">
            Não tem o link? Entre em contato com seu professor e peça o convite.
          </p>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:border-red-200 hover:text-red-500 transition"
          >
            <MdLogout size={16} />
            Sair da conta
          </button>
        </div>

      </div>
    </div>
  )
}
