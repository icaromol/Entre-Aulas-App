// ─── Input Types ─────────────────────────────────────────────────────────────

export interface DayAvailability {
  dayOfWeek: number        // 0=Sun, 1=Mon ... 6=Sat
  minutesAvailable: number
}

export interface ResolvedProgramItem {
  checklistItemId: string
  checklistItemTitle: string
  sourceType: 'piece' | 'exercise'
  sourceId: string
  sourceTitle: string
  sourceCompletion: number    // 0–100 (piece.completion_pct, or 0 for exercises)
  sourceDifficulty: number | null
  isOptional: boolean
  priorityOverride: number | null
}

export interface ResolvedProgram {
  id: string
  title: string
  type: string
  deadline: string | null
  weight: number              // 1–100; sum across all programs must be 100
  items: ResolvedProgramItem[]
}

export interface MaintenancePiece {
  pieceId: string
  pieceTitle: string
  difficulty: number | null
  lastMaintenanceOn: string | null  // YYYY-MM-DD or null (never maintained)
}

export interface GeneratorInput {
  weekStart: string                // YYYY-MM-DD (always Monday)
  horizon: 'week' | 'biweek' | 'month' | number  // number = weeks
  availability: DayAvailability[]  // only active days (minutesAvailable > 0)
  programs: ResolvedProgram[]
  completedItemIds: Set<string>    // checklist_item_ids already completed
  includeRevision: boolean
  maintenance: {
    enabled: boolean
    budgetPercent: number          // default 20 (% of total time for maintenance)
    completedPieces: MaintenancePiece[]
  }
}

// ─── Output Types ─────────────────────────────────────────────────────────────

export interface PlannedTask {
  checklistItemId: string | null   // null for maintenance tasks
  checklistItemTitle: string
  sourceType: 'piece' | 'exercise' | 'maintenance'
  sourceId: string
  sourceTitle: string
  programId: string | null
  programTitle: string
  durationMinutes: number
  isRevision: boolean
  isOptional: boolean
  isMaintenance: boolean
  score: number
}

export interface GeneratedDay {
  weekStart: string
  dayOfWeek: number
  date: string
  minutesAvailable: number
  minutesUsed: number
  tasks: PlannedTask[]
}

export interface GeneratedPlan {
  days: GeneratedDay[]
  unscheduled: PlannedTask[]
  stats: {
    totalTasks: number
    scheduledTasks: number
    periodsGenerated: number
    totalMinutes: number
    minutesByProgram: Record<string, number>
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

type ScoredTask = PlannedTask & { combinedScore: number }

const MIN_TASK_MIN = 5

function resolveHorizon(horizon: GeneratorInput['horizon']): number {
  if (horizon === 'week')   return 1
  if (horizon === 'biweek') return 2
  if (horizon === 'month')  return 4
  return typeof horizon === 'number' ? Math.max(1, horizon) : 1
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
): GeneratedDay[] {
  const days: GeneratedDay[] = []

  for (let w = 0; w < weeks; w++) {
    const monday = addDays(weekStart, w * 7)

    for (const avail of availability) {
      // dayOfWeek 1=Mon ... 6=Sat, 0=Sun
      // weekStart is always Monday (dayOfWeek=1)
      const offset = avail.dayOfWeek === 0 ? 6 : avail.dayOfWeek - 1
      days.push({
        weekStart: monday,
        dayOfWeek: avail.dayOfWeek,
        date: addDays(monday, offset),
        minutesAvailable: avail.minutesAvailable,
        minutesUsed: 0,
        tasks: [],
      })
    }
  }

  return days.sort((a, b) => a.date.localeCompare(b.date))
}

function calcUrgencyBonus(deadline: string | null): number {
  if (!deadline) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(deadline + 'T00:00:00')
  const days = Math.ceil((target.getTime() - today.getTime()) / 86_400_000)

  if (days < 7)  return 0.40
  if (days < 15) return 0.30
  if (days < 31) return 0.20
  if (days < 61) return 0.10
  return 0
}

function calcItemScore(
  item: ResolvedProgramItem,
  deadline: string | null,
): number {
  const difficultyRaw = item.priorityOverride !== null
    ? item.priorityOverride / 10
    : (item.sourceDifficulty ?? 5) / 10

  const incompletion = 1 - item.sourceCompletion / 100
  const urgency = calcUrgencyBonus(deadline)

  let score = 0.50 * difficultyRaw + 0.50 * incompletion + urgency

  if (item.isOptional) score *= 0.30

  return Math.min(score, 1.5)
}

function calcFrequencyPerWeek(score: number, daysPerWeek: number): number {
  return Math.min(daysPerWeek, Math.max(1, Math.round(score * 3)))
}

// Can this day accept one more task without going below MIN_TASK_MIN per task?
function canAcceptTask(day: GeneratedDay): boolean {
  const totalCount = day.tasks.length + 1
  return day.minutesAvailable / totalCount >= MIN_TASK_MIN
}

// ─── Main Generator ───────────────────────────────────────────────────────────

export function generatePlan(input: GeneratorInput): GeneratedPlan {
  const weeks = resolveHorizon(input.horizon)
  const activeDays = input.availability.filter(d => d.minutesAvailable > 0)

  if (activeDays.length === 0 || input.programs.length === 0) {
    return {
      days: [],
      unscheduled: [],
      stats: { totalTasks: 0, scheduledTasks: 0, periodsGenerated: weeks, totalMinutes: 0, minutesByProgram: {} },
    }
  }

  const days = buildHorizonDays(input.weekStart, weeks, activeDays)

  // ── 1. Build study task list ──────────────────────────────────────────────

  const studyTasks: ScoredTask[] = []

  for (const prog of input.programs) {
    for (const item of prog.items) {
      const done = input.completedItemIds.has(item.checklistItemId)
      if (done && !input.includeRevision) continue

      const score = calcItemScore(item, prog.deadline)
      const isRevision = done && input.includeRevision

      // revision items get halved score (less urgent since already completed)
      const effectiveScore = isRevision ? score * 0.50 : score
      const freqPerWeek = calcFrequencyPerWeek(effectiveScore, activeDays.length)

      for (let i = 0; i < freqPerWeek * weeks; i++) {
        studyTasks.push({
          checklistItemId: item.checklistItemId,
          checklistItemTitle: item.checklistItemTitle,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          sourceTitle: item.sourceTitle,
          programId: prog.id,
          programTitle: prog.title,
          durationMinutes: 0,
          isRevision,
          isOptional: item.isOptional,
          isMaintenance: false,
          score: effectiveScore,
          combinedScore: effectiveScore * (prog.weight / 100),
        })
      }
    }
  }

  // Mandatory tasks first, then by combined score DESC
  studyTasks.sort((a, b) => {
    if (a.isOptional !== b.isOptional) return a.isOptional ? 1 : -1
    return b.combinedScore - a.combinedScore
  })

  // ── 2. Build maintenance task list ────────────────────────────────────────

  const mainTasks: ScoredTask[] = []

  if (input.maintenance.enabled && input.maintenance.completedPieces.length > 0) {
    const totalMins = days.reduce((s, d) => s + d.minutesAvailable, 0)
    const mainBudget = totalMins * (input.maintenance.budgetPercent / 100)
    const totalDiff = input.maintenance.completedPieces.reduce(
      (s, p) => s + (p.difficulty ?? 5), 0
    )

    // Sort: never-maintained first, then oldest last_maintenance_on
    const sorted = [...input.maintenance.completedPieces].sort((a, b) => {
      if (!a.lastMaintenanceOn && !b.lastMaintenanceOn) return 0
      if (!a.lastMaintenanceOn) return -1
      if (!b.lastMaintenanceOn) return 1
      return a.lastMaintenanceOn.localeCompare(b.lastMaintenanceOn)
    })

    for (const piece of sorted) {
      const w = totalDiff > 0 ? (piece.difficulty ?? 5) / totalDiff : 1 / sorted.length
      const pieceMins = Math.max(MIN_TASK_MIN, Math.round(mainBudget * w))
      // one session per week for each piece
      const sessMin = Math.max(MIN_TASK_MIN, Math.round(pieceMins / weeks))

      for (let i = 0; i < weeks; i++) {
        mainTasks.push({
          checklistItemId: null,
          checklistItemTitle: 'Manutenção',
          sourceType: 'maintenance',
          sourceId: piece.pieceId,
          sourceTitle: piece.pieceTitle,
          programId: null,
          programTitle: 'Manutenção',
          durationMinutes: sessMin,
          isRevision: false,
          isOptional: false,
          isMaintenance: true,
          score: w,
          combinedScore: w,
        })
      }
    }
  }

  // ── 3. Round-robin assignment ─────────────────────────────────────────────

  const result: GeneratedDay[] = days.map(d => ({ ...d, tasks: [], minutesUsed: 0 }))
  const unscheduled: PlannedTask[] = []

  function assignRoundRobin(tasks: ScoredTask[], startIdx: number): number {
    let dayIdx = startIdx
    for (const task of tasks) {
      let placed = false
      for (let attempt = 0; attempt < result.length; attempt++) {
        const idx = (dayIdx + attempt) % result.length
        if (canAcceptTask(result[idx])) {
          result[idx].tasks.push(task)
          dayIdx = (idx + 1) % result.length
          placed = true
          break
        }
      }
      if (!placed) unscheduled.push(task)
    }
    return dayIdx
  }

  let cursor = 0
  cursor = assignRoundRobin(studyTasks, cursor)
  assignRoundRobin(mainTasks, cursor)

  // ── 4. Recalculate durations per day ─────────────────────────────────────

  const minutesByProgram: Record<string, number> = {}

  for (const day of result) {
    if (day.tasks.length === 0) continue

    const mainFixed = day.tasks
      .filter(t => t.isMaintenance)
      .reduce((s, t) => s + t.durationMinutes, 0)

    const studyBudget = Math.max(0, day.minutesAvailable - mainFixed)
    const studyCount = day.tasks.filter(t => !t.isMaintenance).length
    const studyPerTask = studyCount > 0
      ? Math.max(MIN_TASK_MIN, Math.floor(studyBudget / studyCount))
      : 0

    day.tasks = day.tasks.map(t => {
      if (t.isMaintenance) return t
      const dur = studyPerTask
      if (t.programId) {
        minutesByProgram[t.programId] = (minutesByProgram[t.programId] ?? 0) + dur
      }
      return { ...t, durationMinutes: dur }
    })

    day.minutesUsed = day.tasks.reduce((s, t) => s + t.durationMinutes, 0)
  }

  const scheduledCount = (studyTasks.length + mainTasks.length) - unscheduled.length

  return {
    days: result,
    unscheduled,
    stats: {
      totalTasks: studyTasks.length + mainTasks.length,
      scheduledTasks: scheduledCount,
      periodsGenerated: weeks,
      totalMinutes: result.reduce((s, d) => s + d.minutesUsed, 0),
      minutesByProgram,
    },
  }
}
