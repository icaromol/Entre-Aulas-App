import confetti from 'canvas-confetti'

const COLORS = ['#153b50', '#b2f0fb', '#f4d1ae', '#FFFFFF']

export function fireBasic() {
  confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 }, colors: COLORS })
}

export function fireSideCannons() {
  const end = Date.now() + 2000
  ;(function frame() {
    confetti({ particleCount: 3, angle: 60,  spread: 55, origin: { x: 0 }, colors: COLORS })
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: COLORS })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
}

export function fireStars() {
  const defaults = {
    spread: 360, ticks: 50, gravity: 0, decay: 0.94, startVelocity: 30,
    colors: [...COLORS, '#FFD700'],
  }
  confetti({ ...defaults, particleCount: 40, scalar: 1.2, shapes: ['star'] })
  confetti({ ...defaults, particleCount: 10, scalar: 0.75, shapes: ['circle'] })
}

const RANK_KEYS = new Set([
  'rank_estudante_4', 'rank_amador_4', 'rank_junior_4',
  'rank_profissional_4', 'rank_expert', 'rank_mestre',
])

export function hasRankUp(achievements: string[]): boolean {
  return achievements.some(k => RANK_KEYS.has(k))
}
