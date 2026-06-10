export type ProgramaType =
  | 'regular' | 'recital' | 'concerto' | 'show'
  | 'gravacao' | 'exame' | 'participacao' | 'outro'

export type ProgramaStatus = 'active' | 'completed' | 'archived'

export interface Programa {
  id: string
  student_id: string
  teacher_id: string
  title: string
  type: ProgramaType
  deadline: string | null
  venue: string | null
  status: ProgramaStatus
  notes: string | null
  priority: number | null
  created_at: string
}

export interface ProgramPiece {
  id: string
  program_id: string
  piece_id: string
  priority_override: number | null
  piece?: {
    id: string
    title: string
    composer: string | null
    difficulty: number | null
    completion_pct: number
  }
}

export interface ProgramExercise {
  id: string
  program_id: string
  exercise_id: string
  priority_override: number | null
  exercise?: {
    id: string
    title: string
    category: string
    difficulty: number | null
  }
}
