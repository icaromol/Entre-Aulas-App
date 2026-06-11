export interface PlanItem {
  id: string
  plan_id: string
  day_of_week: number
  piece_id: string | null
  exercise_id: string | null
  program_id: string | null
  duration_minutes: number | null
  position: number
  is_done: boolean
  done_at: string | null
  completed_manually: boolean
  is_maintenance: boolean
  moved_from_dow: number | null
  // joined
  piece?: { title: string; composer: string | null } | null
  exercise?: { title: string; category: string } | null
  programa?: { title: string; type: string } | null
}

export interface WeeklyPlan {
  id: string
  student_id: string
  teacher_id: string
  week_start: string
  notes: string | null
}
