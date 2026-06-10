// ─── Pomodoro por nível ───────────────────────────────────────────────────────

const POMODORO = {
  beginner:     { work: 10, break: 5, cycle: 15 },
  intermediate: { work: 15, break: 5, cycle: 20 },
  advanced:     { work: 25, break: 5, cycle: 30 },
} as const

const EXERCISE_MAX_PCT = 0.20   // cap de exercícios: 20% dos slots

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface DayAvailability {
  dayOfWeek: number          // 0=Dom, 1=Seg … 6=Sáb
  minutesAvailable: number
}

export interface ProgramPiece {
  pieceId: string
  pieceTitle: string
  completionPct: number      // 0–100
  status: string             // 'in_progress' | 'future' | 'completed'
}

export interface ProgramExercise {
  exerciseId: string
  exerciseTitle: string
  difficulty: number | null
  category: string
}

export interface ResolvedProgram {
  id: string
  title: string
  type: string
  deadline: string | null
  weight: number             // 1–100; soma dos selecionados = 100
  priority: number | null    // 1–5; importância do objetivo; null = neutro (3)
  pieces: ProgramPiece[]
  exercises: ProgramExercise[]
}

export interface MaintenancePiece {
  pieceId: string
  pieceTitle: string
}

export interface GeneratorInput {
  studentLevel: 'beginner' | 'intermediate' | 'advanced'
  weekStart: string          // YYYY-MM-DD (sempre segunda-feira)
  horizon: 'week' | 'biweek' | 'month' | number
  availability: DayAvailability[]
  programs: ResolvedProgram[]
  maintenance: {
    enabled: boolean
    budgetPercent: number    // 10–40
    completedPieces: MaintenancePiece[]
  }
}

// ─── Output Types ─────────────────────────────────────────────────────────────

export interface PlannedTask {
  pieceId: string | null
  exerciseId: string | null
  sourceType: 'piece' | 'exercise' | 'maintenance'
  sourceTitle: string
  programId: string | null
  programTitle: string
  durationMinutes: number
  isMaintenance: boolean
  score: number
}

export interface GeneratedDay {
  weekStart: string
  dayOfWeek: number
  date: string
  minutesAvailable: number
  slots: number              // quantos ciclos pomodoro cabem no dia
  minutesUsed: number
  tasks: PlannedTask[]
}

export interface GeneratedPlan {
  days: GeneratedDay[]
  unscheduled: PlannedTask[]
  pomodoroWork: number       // minutos de trabalho por slot (10 | 15 | 25)
  stats: {
    totalTasks: number
    scheduledTasks: number
    periodsGenerated: number
    totalMinutes: number
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

type ScoredTask = PlannedTask & { combinedScore: number }

function resolveHorizon(h: GeneratorInput['horizon']): number {
  if (h === 'week')   return 1
  if (h === 'biweek') return 2
  if (h === 'month')  return 4
  return typeof h === 'number' ? Math.max(1, h) : 1
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function buildHorizonDays(
  weekStart: string,
  weeks: number,
  availability: DayAvailability[],
  workMin: number,
): GeneratedDay[] {
  const days: GeneratedDay[] = []
  for (let w = 0; w < weeks; w++) {
    const monday = addDays(weekStart, w * 7)
    for (const avail of availability) {
      const offset = avail.dayOfWeek === 0 ? 6 : avail.dayOfWeek - 1
      // Quantos slots de workMin cabem no tempo disponível
      const slots = Math.max(0, Math.floor(avail.minutesAvailable / workMin))
      days.push({
        weekStart: monday,
        dayOfWeek: avail.dayOfWeek,
        date: addDays(monday, offset),
        minutesAvailable: avail.minutesAvailable,
        slots,
        minutesUsed: 0,
        tasks: [],
      })
    }
  }
  return days.sort((a, b) => a.date.localeCompare(b.date))
}

// Urgência contínua: quanto mais próximo o prazo, maior o valor (0.0–1.0)
function calcUrgency(deadline: string | null): number {
  if (!deadline) return 0
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.ceil((new Date(deadline + 'T00:00:00').getTime() - today.getTime()) / 86_400_000)
  if (days <= 0)  return 1.00
  if (days < 7)   return 0.80
  if (days < 15)  return 0.60
  if (days < 31)  return 0.40
  if (days < 61)  return 0.20
  return 0.05
}

// Score de peça: 50% trabalho restante + 30% urgência de prazo
// O peso da meta (20%) entra via progWeight externamente
function calcPieceScore(completionPct: number, deadline: string | null): number {
  const trabalhoRestante = (100 - completionPct) / 100
  return 0.5 * trabalhoRestante + 0.3 * calcUrgency(deadline)
}

// Score de exercício: baseado em dificuldade
function calcExerciseScore(difficulty: number | null): number {
  return (difficulty ?? 5) / 10
}

// Constrói fila com exatamente `budget` ocorrências, distribuídas proporcionalmente ao score.
// Peças de maior score repetem mais; todos os slots do aluno são preenchidos.
function buildQueue(items: ScoredTask[], budget: number): ScoredTask[] {
  if (items.length === 0 || budget === 0) return []

  const sorted     = [...items].sort((a, b) => b.combinedScore - a.combinedScore)
  const totalScore = sorted.reduce((s, i) => s + i.combinedScore, 0) || sorted.length
  const reps: ScoredTask[] = []

  // Alocação proporcional ao score
  for (const item of sorted) {
    const freq = Math.max(1, Math.round(item.combinedScore / totalScore * budget))
    for (let i = 0; i < freq; i++) reps.push({ ...item })
  }

  // Preenche slots restantes ciclando do maior para o menor score
  let ci = 0
  while (reps.length < budget) {
    reps.push({ ...sorted[ci % sorted.length] })
    ci++
  }

  reps.sort((a, b) => b.combinedScore - a.combinedScore)
  return reps.slice(0, budget)
}

// ─── Gerador principal ────────────────────────────────────────────────────────

export function generatePlan(input: GeneratorInput): GeneratedPlan {
  const weeks = resolveHorizon(input.horizon)
  const activeDays = input.availability.filter(d => d.minutesAvailable > 0)
  const pomo = POMODORO[input.studentLevel]

  if (activeDays.length === 0 || input.programs.length === 0) {
    return {
      days: [], unscheduled: [], pomodoroWork: pomo.work,
      stats: { totalTasks: 0, scheduledTasks: 0, periodsGenerated: weeks, totalMinutes: 0 },
    }
  }

  const days = buildHorizonDays(input.weekStart, weeks, activeDays, pomo.work)
  const totalSlots = days.reduce((s, d) => s + d.slots, 0)

  if (totalSlots === 0) {
    return {
      days, unscheduled: [], pomodoroWork: pomo.work,
      stats: { totalTasks: 0, scheduledTasks: 0, periodsGenerated: weeks, totalMinutes: 0 },
    }
  }

  // ── 1. Coletar e pontuar itens ──────────────────────────────────────────────

  // Deduplica por ID mantendo o maior combined score
  const pieceMap    = new Map<string, ScoredTask>()
  const exerciseMap = new Map<string, ScoredTask>()

  for (const prog of input.programs) {
    const progWeight = prog.weight / 100   // priority já incorporada no weight (via autoplan)

    for (const p of prog.pieces) {
      if (p.status === 'completed') continue   // tratado em manutenção
      const score         = calcPieceScore(p.completionPct, prog.deadline)
      const combinedScore = score * progWeight
      const existing      = pieceMap.get(p.pieceId)
      if (!existing || combinedScore > existing.combinedScore) {
        pieceMap.set(p.pieceId, {
          pieceId: p.pieceId, exerciseId: null,
          sourceType: 'piece', sourceTitle: p.pieceTitle,
          programId: prog.id, programTitle: prog.title,
          durationMinutes: pomo.work,
          isMaintenance: false, score, combinedScore,
        })
      }
    }

    for (const e of prog.exercises) {
      const score         = calcExerciseScore(e.difficulty)
      const combinedScore = score * progWeight
      const existing      = exerciseMap.get(e.exerciseId)
      if (!existing || combinedScore > existing.combinedScore) {
        exerciseMap.set(e.exerciseId, {
          pieceId: null, exerciseId: e.exerciseId,
          sourceType: 'exercise', sourceTitle: e.exerciseTitle,
          programId: prog.id, programTitle: prog.title,
          durationMinutes: pomo.work,
          isMaintenance: false, score, combinedScore,
        })
      }
    }
  }

  // ── 2. Manutenção ───────────────────────────────────────────────────────────

  const mainItems: ScoredTask[] = []
  if (input.maintenance.enabled && input.maintenance.completedPieces.length > 0) {
    for (const p of input.maintenance.completedPieces) {
      const score = calcPieceScore(100, null) * 0.35
      mainItems.push({
        pieceId: p.pieceId, exerciseId: null,
        sourceType: 'maintenance', sourceTitle: p.pieceTitle,
        programId: null, programTitle: 'Manutenção',
        durationMinutes: pomo.work,
        isMaintenance: true, score, combinedScore: score,
      })
    }
    mainItems.sort((a, b) => b.combinedScore - a.combinedScore)
  }

  // ── 3. Orçamentos de slots ──────────────────────────────────────────────────

  const mainBudget = input.maintenance.enabled
    ? Math.min(Math.floor(totalSlots * input.maintenance.budgetPercent / 100), mainItems.length * weeks)
    : 0
  const workSlots = Math.max(0, totalSlots - mainBudget)

  // Exercícios: cap de 20% do total de slots de trabalho
  const exerciseBudget = Math.min(
    Math.ceil(workSlots * EXERCISE_MAX_PCT),
    exerciseMap.size * weeks * activeDays.length,
  )
  const pieceBudget = Math.max(0, workSlots - exerciseBudget)

  // ── 4. Construir fila de tarefas por programa (respeita peso) ───────────────

  // Agrupa itens por programa
  const piecesByProg    = new Map<string, ScoredTask[]>()
  const exercisesByProg = new Map<string, ScoredTask[]>()
  for (const item of pieceMap.values()) {
    const key = item.programId ?? '__none__'
    if (!piecesByProg.has(key)) piecesByProg.set(key, [])
    piecesByProg.get(key)!.push(item)
  }
  for (const item of exerciseMap.values()) {
    const key = item.programId ?? '__none__'
    if (!exercisesByProg.has(key)) exercisesByProg.set(key, [])
    exercisesByProg.get(key)!.push(item)
  }

  // Aloca slots de peças proporcionalmente ao peso de cada programa
  const pieceQueue: ScoredTask[] = []
  for (const prog of input.programs) {
    const items = piecesByProg.get(prog.id) ?? []
    if (items.length === 0) continue
    const budget = Math.round(pieceBudget * (prog.weight / 100))
    pieceQueue.push(...buildQueue(items, Math.max(items.length, budget)))
  }
  // Ajusta para pieceBudget exato ciclando do maior score
  const allPiecesSorted = [...pieceMap.values()].sort((a, b) => b.combinedScore - a.combinedScore)
  let pi = 0
  while (pieceQueue.length < pieceBudget) { pieceQueue.push({ ...allPiecesSorted[pi++ % allPiecesSorted.length] }) }

  // Aloca slots de exercícios proporcionalmente ao peso de cada programa
  const exerciseQueue: ScoredTask[] = []
  for (const prog of input.programs) {
    const items = exercisesByProg.get(prog.id) ?? []
    if (items.length === 0) continue
    const budget = Math.round(exerciseBudget * (prog.weight / 100))
    exerciseQueue.push(...buildQueue(items, Math.max(items.length, budget)))
  }
  const allExercisesSorted = [...exerciseMap.values()].sort((a, b) => b.combinedScore - a.combinedScore)
  let ei = 0
  while (exerciseQueue.length < exerciseBudget && allExercisesSorted.length > 0) { exerciseQueue.push({ ...allExercisesSorted[ei++ % allExercisesSorted.length] }) }

  const mainQueue = buildQueue(mainItems, mainBudget)


  const fullQueue: ScoredTask[] = [...pieceQueue, ...exerciseQueue, ...mainQueue]
  fullQueue.sort((a, b) => b.combinedScore - a.combinedScore)

  // ── 5. Distribuição round-robin ─────────────────────────────────────────────

  const result: GeneratedDay[] = days.map(d => ({ ...d, tasks: [], minutesUsed: 0 }))
  const unscheduled: PlannedTask[] = []

  let dayIdx = 0
  for (const task of fullQueue) {
    let placed = false
    for (let attempt = 0; attempt < result.length; attempt++) {
      const idx = (dayIdx + attempt) % result.length
      const day = result[idx]
      if (day.tasks.length < day.slots) {
        day.tasks.push(task)
        day.minutesUsed += task.durationMinutes
        dayIdx = (idx + 1) % result.length
        placed = true
        break
      }
    }
    if (!placed) unscheduled.push(task)
  }

  // ── 6. Aglutinar duplicatas por dia ────────────────────────────────────────
  // Mesma peça/exercício no mesmo dia → 1 card com a soma dos minutos

  for (const day of result) {
    const merged = new Map<string, PlannedTask>()
    for (const task of day.tasks) {
      const key = task.isMaintenance
        ? `maint:${task.pieceId}`
        : task.pieceId
          ? `piece:${task.pieceId}`
          : task.exerciseId
            ? `ex:${task.exerciseId}`
            : `custom:${task.sourceTitle}`
      const existing = merged.get(key)
      if (existing) {
        existing.durationMinutes += task.durationMinutes
      } else {
        merged.set(key, { ...task })
      }
    }
    day.tasks = [...merged.values()]
    day.minutesUsed = day.tasks.reduce((s, t) => s + t.durationMinutes, 0)
  }

  return {
    days: result,
    unscheduled,
    pomodoroWork: pomo.work,
    stats: {
      totalTasks: fullQueue.length,
      scheduledTasks: fullQueue.length - unscheduled.length,
      periodsGenerated: weeks,
      totalMinutes: result.reduce((s, d) => s + d.minutesUsed, 0),
    },
  }
}
