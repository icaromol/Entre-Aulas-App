import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  MdArrowBack, MdTaskAlt, MdEdit, MdDeleteOutline,
  MdNotes, MdHistory, MdCheckCircle,
  MdPerson, MdMenuBook, MdLibraryMusic, MdBuild, MdStars,
  MdMusicNote, MdFlashOn, MdFavorite, MdGraphicEq, MdMic, MdFolder,
  MdEmojiEvents, MdBolt,
} from 'react-icons/md'
import { supabase } from '@/lib/supabase'
import { isValidUUID } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { Button } from '@/components/ui/button'
import { grantXp, ACHIEVEMENT_LABEL } from '@/lib/xpHelpers'
import { fireStars } from '@/lib/confettiEffects'
import { sound } from '@/lib/soundEffects'

interface Piece {
  id: string; title: string; composer: string | null; catalog_number: string | null
  period: string | null; difficulty: number | null; pedagogical_goal: string | null
  status: string; completion_pct: number; notes: string | null
}

interface ChecklistItem {
  id: string; title: string; category: string | null; position: number
  is_optional: boolean; completed: boolean
}

interface SessionItem {
  piece_id: string | null
  plan_item: { checklist_item: { title: string } | null } | null
}

interface StudySession {
  id: string
  started_at: string
  duration_seconds: number
  cycle_name: string
  difficulty_felt: 'easy' | 'ok' | 'hard' | null
  notes: string | null
  session_items: SessionItem[]
}

const periodLabel: Record<string, string> = {
  baroque: 'Barroco', classical: 'Clássico', romantic: 'Romântico',
  modern: 'Moderno', contemporary: 'Contemporâneo', popular: 'Popular', other: 'Outro',
}

const difficultyLabel: Record<string, { label: string; color: string }> = {
  easy: { label: 'Fácil',      color: 'bg-green-50 text-green-600' },
  ok:   { label: 'Moderada',   color: 'bg-blue-50 text-[#4A90C4]' },
  hard: { label: 'Desafiadora', color: 'bg-red-50 text-red-500' },
}

const statusOptions = [
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed',   label: 'Concluída' },
  { value: 'paused',      label: 'Pausada' },
  { value: 'future',      label: 'Repertório futuro' },
]

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDuration(secs: number) {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return s > 0 ? `${m}min ${s}s` : `${m}min`
}

type TabKey = 'checklist' | 'details' | 'history'

export default function StudentPieceDetailPage() {
  const { pieceId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [piece, setPiece] = useState<Piece | null>(null)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [studentId, setStudentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [newItemTitle, setNewItemTitle] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('checklist')

  useEffect(() => {
    if (!profile) return
    supabase.from('students').select('id').eq('profile_id', profile.id).single()
      .then(({ data }) => { if (data) setStudentId(data.id) })
  }, [profile])

  useEffect(() => {
    if (pieceId && studentId) fetchAll()
  }, [pieceId, studentId])

  async function fetchAll() {
    const [pieceRes, checklistRes, completionsRes] = await Promise.all([
      supabase.from('pieces').select('*').eq('id', pieceId!).single(),
      supabase.from('checklist_items').select('*').eq('piece_id', pieceId!).order('position'),
      supabase.from('checklist_completions').select('checklist_item_id').eq('student_id', studentId!),
    ])

    const completedIds = new Set(
      (completionsRes.data ?? []).map((c: { checklist_item_id: string }) => c.checklist_item_id)
    )
    setPiece(pieceRes.data)
    setChecklist(
      (checklistRes.data ?? []).map((item: ChecklistItem) => ({ ...item, completed: completedIds.has(item.id) }))
    )
    setLoading(false)
  }

  async function fetchHistory() {
    if (!studentId || !pieceId) return
    setLoadingHistory(true)

    // Find session IDs via session_items.piece_id (set during saveSession in PomodoroPage)
    const { data: siData } = await supabase
      .from('session_items')
      .select('session_id')
      .eq('piece_id', pieceId)

    const sessionIds = [...new Set(
      (siData ?? []).map((r: { session_id: string }) => r.session_id).filter(Boolean)
    )]

    if (sessionIds.length === 0) {
      setSessions([])
      setLoadingHistory(false)
      return
    }

    const { data } = await supabase
      .from('study_sessions')
      .select(`
        id, started_at, duration_seconds, cycle_name, difficulty_felt, notes,
        session_items(
          piece_id,
          plan_item:plan_items(
            checklist_item:checklist_items(title)
          )
        )
      `)
      .eq('student_id', studentId)
      .in('id', sessionIds)
      .order('started_at', { ascending: false })

    setSessions((data ?? []) as unknown as StudySession[])
    setLoadingHistory(false)
  }

  function switchTab(tab: TabKey) {
    setActiveTab(tab)
    if (tab === 'history' && sessions.length === 0) fetchHistory()
  }

  async function toggleItem(item: ChecklistItem) {
    if (!studentId) return
    if (item.completed) {
      await supabase.from('checklist_completions').delete()
        .eq('checklist_item_id', item.id).eq('student_id', studentId)
    } else {
      await supabase.from('checklist_completions').insert({ checklist_item_id: item.id, student_id: studentId, completed_at: new Date().toISOString() })
    }
    const updated = checklist.map(c => c.id === item.id ? { ...c, completed: !c.completed } : c)
    setChecklist(updated)
    const mandatory = updated.filter(c => !c.is_optional)
    const pct = mandatory.length > 0 ? Math.round((mandatory.filter(c => c.completed).length / mandatory.length) * 100) : 0
    setPiece(prev => prev ? { ...prev, completion_pct: pct } : prev)

    if (pct === 100 && !item.completed) {
      // Auto-complete status
      await supabase.from('pieces').update({ status: 'completed' }).eq('id', pieceId!)
      setPiece(prev => prev ? { ...prev, status: 'completed' } : prev)

      // XP once per piece — check if already granted
      const { data: existing } = await supabase
        .from('student_xp_events')
        .select('id')
        .eq('student_id', studentId)
        .eq('reason', 'piece_completed')
        .eq('source_id', pieceId!)
        .maybeSingle()

      if (!existing) {
        sound.xpEarn()
        fireStars()
        toast.success('🎉 Peça concluída! +10 XP')
        const { newAchievements } = await grantXp(studentId, 'piece_completed', pieceId!, null, 10)
        for (const key of newAchievements) toast.success(`🏅 ${ACHIEVEMENT_LABEL[key] ?? key}`)
      } else {
        toast.success('Peça concluída!')
      }
    }
  }

  async function addCustomItem() {
    if (!newItemTitle.trim()) return
    setAddingItem(true)
    const maxPosition = checklist.length > 0 ? Math.max(...checklist.map(c => c.position)) + 1 : 0
    const { data } = await supabase.from('checklist_items').insert({
      piece_id: pieceId!, title: newItemTitle.trim(),
      category: 'Personalizado', position: maxPosition, is_default: false, is_optional: false,
    }).select().single()
    if (data) { setChecklist(prev => [...prev, { ...data, completed: false }]); toast.success('Item adicionado') }
    setNewItemTitle(''); setAddingItem(false)
  }

  async function updateStatus(newStatus: string) {
    setSavingStatus(true)
    await supabase.from('pieces').update({ status: newStatus }).eq('id', pieceId!)
    setPiece(prev => prev ? { ...prev, status: newStatus } : prev)
    setSavingStatus(false); toast.success('Status atualizado')
  }

  async function deletePiece() {
    if (!confirm('Excluir esta peça? Esta ação não pode ser desfeita.')) return
    await supabase.from('pieces').delete().eq('id', pieceId!)
    toast.success('Peça excluída')
    navigate('/aluno/repertorio?tab=pieces')
  }

  if (!isValidUUID(pieceId)) return <Navigate to="/" replace />
  if (loading) return <StudentLayout><div className="flex justify-center py-12"><Spinner /></div></StudentLayout>
  if (!piece) return <StudentLayout><p className="text-sm text-red-400">Peça não encontrada.</p></StudentLayout>

  const grouped = checklist.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    const cat = item.category ?? 'Geral'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  const periodIcon: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    baroque: MdLibraryMusic, classical: MdMusicNote, romantic: MdFavorite,
    modern: MdGraphicEq, contemporary: MdFlashOn, popular: MdMic, other: MdFolder,
  }
  const goalIcon: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    technique: MdBuild, performance: MdStars, sight_reading: MdMenuBook,
    recital: MdEmojiEvents, other: MdFolder,
  }

  const detailFields: { Icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }[] = [
    piece.composer       ? { Icon: MdPerson,    label: 'Compositor',          value: piece.composer } : null,
    piece.catalog_number ? { Icon: MdMenuBook,  label: 'Opus / Catálogo',     value: piece.catalog_number } : null,
    piece.period         ? { Icon: periodIcon[piece.period] ?? MdMusicNote, label: 'Período', value: periodLabel[piece.period] ?? piece.period } : null,
    piece.pedagogical_goal ? { Icon: goalIcon[piece.pedagogical_goal] ?? MdStars, label: 'Objetivo pedagógico', value: piece.pedagogical_goal } : null,
    piece.difficulty     ? { Icon: MdBolt,      label: 'Dificuldade',         value: `${piece.difficulty}/10` } : null,
    piece.notes          ? { Icon: MdNotes,     label: 'Notas',               value: piece.notes } : null,
  ].filter((f): f is { Icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string } => f !== null)

  return (
    <StudentLayout>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/aluno/repertorio?tab=pieces" className="text-gray-400 hover:text-gray-600 transition">
          <MdArrowBack size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#1E3A5F]">{piece.title}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {piece.composer ?? '—'}
            {piece.catalog_number && ` · ${piece.catalog_number}`}
            {piece.period && ` · ${periodLabel[piece.period] ?? piece.period}`}
          </p>
        </div>
        <Link to={`/aluno/repertorio/pecas/${pieceId}/editar`} className="text-gray-400 hover:text-[#4A90C4] transition">
          <MdEdit size={20} />
        </Link>
      </div>

      {/* Progresso + Status */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-600">Progresso</span>
          <span className="text-xl font-bold text-[#1E3A5F]">{piece.completion_pct}%</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${piece.completion_pct === 100 ? 'bg-green-500' : 'bg-[#4A90C4]'}`}
            style={{ width: `${piece.completion_pct}%` }} />
        </div>
        <div className="mt-4 space-y-1">
          <label className="text-xs font-medium text-gray-500">Status</label>
          <select value={piece.status} onChange={e => updateStatus(e.target.value)}
            disabled={savingStatus}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] transition bg-white">
            {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        {([
          { key: 'checklist' as TabKey, label: 'Checklist' },
          { key: 'details'   as TabKey, label: 'Detalhes' },
          { key: 'history'   as TabKey, label: 'Histórico' },
        ]).map(tab => (
          <button key={tab.key} onClick={() => switchTab(tab.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === tab.key ? 'bg-white text-[#1E3A5F] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Checklist */}
      {activeTab === 'checklist' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 mb-4">
            <MdTaskAlt size={15} />Checklist
          </h2>
          <div className="space-y-5">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{category}</p>
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 group">
                      <button onClick={() => toggleItem(item)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${
                          item.completed ? 'bg-[#1E3A5F] border-[#1E3A5F]' : 'border-gray-300 hover:border-[#4A90C4]'
                        }`}>
                        {item.completed && (
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                            <path d="M5 13l4 4L19 7"/>
                          </svg>
                        )}
                      </button>
                      <span className={`text-sm flex-1 ${item.completed ? 'line-through text-gray-300' : 'text-gray-700'} ${item.is_optional ? 'italic' : ''}`}>
                        {item.title}
                        {item.is_optional && <span className="text-xs text-gray-400 ml-1">(opcional)</span>}
                      </span>
                      <button
                        onClick={() => {
                          supabase.from('checklist_items').delete().eq('id', item.id)
                            .then(() => setChecklist(prev => prev.filter(c => c.id !== item.id)))
                        }}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition text-xs shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">Adicionar item personalizado</p>
            <div className="flex gap-2">
              <input value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomItem())}
                placeholder="Ex: Trabalhar digitação do compasso 12"
                maxLength={200}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#4A90C4] focus:ring-2 focus:ring-[#4A90C4]/20 transition" />
              <Button onClick={addCustomItem} disabled={addingItem || !newItemTitle.trim()}
                className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white text-xs px-4">
                {addingItem ? '...' : 'Adicionar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Detalhes */}
      {activeTab === 'details' && (
        <div className="space-y-3 mb-5">
          {detailFields.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-[#1E3A5F] flex items-center justify-center mx-auto mb-3">
                <MdNotes size={24} color="white" />
              </div>
              <p className="text-sm font-semibold text-gray-600">Nenhum detalhe cadastrado</p>
              <p className="text-xs text-gray-400 mt-1">Edite a peça para adicionar informações.</p>
            </div>
          ) : (
            detailFields.map(field => (
              <div key={field.label} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-[#1E3A5F] flex items-center justify-center shrink-0">
                  <field.Icon size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium">{field.label}</p>
                  <p className="text-sm text-gray-800 mt-0.5 leading-relaxed">{field.value}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Histórico */}
      {activeTab === 'history' && (
        <div className="space-y-3 mb-5">
          {loadingHistory ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : sessions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-[#1E3A5F] flex items-center justify-center mx-auto mb-3">
                <MdHistory size={24} color="white" />
              </div>
              <p className="text-sm font-semibold text-gray-600">Nenhuma sessão registrada</p>
              <p className="text-xs text-gray-400 mt-1">As sessões de estudo desta peça aparecerão aqui.</p>
            </div>
          ) : (
            sessions.map(session => {
              const workedItems = session.session_items
                .filter(si => si.piece_id === pieceId)
                .map(si => si.plan_item?.checklist_item?.title)
                .filter((t): t is string => !!t)
              const diff = session.difficulty_felt ? difficultyLabel[session.difficulty_felt] : null

              return (
                <div key={session.id} className="bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {fmtDate(session.started_at)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {fmtTime(session.started_at)} · {session.cycle_name} · {fmtDuration(session.duration_seconds)}
                      </p>
                    </div>
                    {diff && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${diff.color}`}>
                        {diff.label}
                      </span>
                    )}
                  </div>

                  {workedItems.length > 0 && (
                    <div className="space-y-1.5">
                      {workedItems.map((title, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <MdCheckCircle size={13} className="text-[#4A90C4] shrink-0" />
                          <span className="text-xs text-gray-600">{title}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {session.notes && (
                    <p className="text-xs text-gray-500 italic border-t border-gray-100 pt-2">
                      {session.notes}
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      <button onClick={deletePiece}
        className="w-full py-3 rounded-2xl border border-red-200 text-sm font-medium text-red-400 hover:bg-red-50 transition flex items-center justify-center gap-1.5">
        <MdDeleteOutline size={16} />Excluir peça
      </button>
    </StudentLayout>
  )
}
