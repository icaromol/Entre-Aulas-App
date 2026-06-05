export interface PlanItem {
  id: string
  plan_id: string
  day_of_week: number
  piece_id: string | null
  exercise_id: string | null
  duration_minutes: number | null
  position: number
  notes: string | null
  is_done: boolean
  done_at: string | null
  piece?: { title: string; composer: string | null; completion_pct: number }
  exercise?: { title: string; category: string }
}

export interface WeeklyPlan {
  id: string
  student_id: string
  teacher_id: string
  week_start: string
  notes: string | null
}