function play(file: string) {
  try {
    new Audio(`/sounds/${file}`).play()
  } catch {
    // silencia erros de autoplay policy do browser
  }
}

export const sound = {
  xpEarn:            () => play('xp_earn.mp3'),
  pomodoroSection:   () => play('pomodoro_section_finish.mp3'),
  pomodoroSuccess:   () => play('pomodoro_success.mp3'),
}
