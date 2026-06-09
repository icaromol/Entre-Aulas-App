import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdSchool, MdLink } from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { StudentLayout } from '@/components/layout/StudentLayout'

export default function StudentPendingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [inviteUrl, setInviteUrl] = useState('')
  const [linking, setLinking] = useState(false)

  async function handleLinkInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    let studentId: string | null = null
    let token: string | null = null
    try {
      const url = new URL(inviteUrl.trim())
      studentId = url.searchParams.get('invite')
    } catch {
      toast.error('URL de convite inválida.')
      return
    }

    if (!studentId) {
      toast.error('URL de convite inválida. Verifique o link enviado pelo professor.')
      return
    }

    setLinking(true)

    const { data: student, error: fetchErr } = await supabase
      .from('students')
      .select('id, invite_token, invite_expires_at, profile_id')
      .eq('id', studentId)
      .single()

    if (fetchErr || !student) { toast.error('Convite não encontrado.'); setLinking(false); return }
    if (student.profile_id)   { toast.error('Este convite já foi usado por outra conta.'); setLinking(false); return }
    if (!student.invite_token) { toast.error('Este convite não é válido.'); setLinking(false); return }
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

    if (updateErr) { toast.error('Erro ao vincular conta. Tente novamente.'); setLinking(false); return }

    toast.success('Professor vinculado com sucesso!')
    window.location.replace('/aluno/hoje')
  }

  return (
    <StudentLayout>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          ←
        </button>
        <h1 className="text-lg font-bold text-[#1E3A5F]">Vincular professor</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex flex-col items-center gap-3 text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#D6E4F0] flex items-center justify-center">
            <MdSchool size={28} color="#1E3A5F" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1E3A5F]">Conectar a um professor</h2>
            <p className="text-sm text-gray-400 mt-1 leading-relaxed">
              Cole o link de convite enviado pelo seu professor para vincular sua conta.
            </p>
          </div>
        </div>

        <form onSubmit={handleLinkInvite} className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 font-medium">Link de convite</label>
            <div className="relative mt-1">
              <MdLink size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="url"
                value={inviteUrl}
                onChange={e => setInviteUrl(e.target.value)}
                placeholder="https://estudamus.vercel.app/cadastro?invite=..."
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
            {linking ? 'Vinculando...' : 'Vincular professor'}
          </button>
        </form>
      </div>
    </StudentLayout>
  )
}
