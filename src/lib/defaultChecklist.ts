export interface ChecklistItemTemplate {
  title: string
  category: string
  position: number
  is_optional: boolean
}

export const DEFAULT_CHECKLIST: ChecklistItemTemplate[] = [
  // Aprendizado inicial
  { title: 'Leitura das notas (voz/mão principal)', category: 'Aprendizado inicial', position: 0, is_optional: false },
  { title: 'Leitura das notas (voz/mão secundária)', category: 'Aprendizado inicial', position: 1, is_optional: false },
  { title: 'Leitura completa / mãos juntas', category: 'Aprendizado inicial', position: 2, is_optional: false },
  { title: 'Definição de dedilhados / digitações', category: 'Aprendizado inicial', position: 3, is_optional: false },
  // Desenvolvimento técnico
  { title: 'Trabalho rítmico em fragmentos', category: 'Desenvolvimento técnico', position: 4, is_optional: false },
  { title: 'Trabalho em andamento lento', category: 'Desenvolvimento técnico', position: 5, is_optional: false },
  { title: 'Trabalho por seções', category: 'Desenvolvimento técnico', position: 6, is_optional: false },
  { title: 'Execução completa em andamento de estudo', category: 'Desenvolvimento técnico', position: 7, is_optional: false },
  // Musicalidade
  { title: 'Análise de frases e respirações', category: 'Musicalidade', position: 8, is_optional: false },
  { title: 'Dinâmicas aplicadas', category: 'Musicalidade', position: 9, is_optional: false },
  { title: 'Caráter e estilo do período', category: 'Musicalidade', position: 10, is_optional: false },
  { title: 'Peça inteira com expressão e intenção', category: 'Musicalidade', position: 11, is_optional: false },
  // Performance
  { title: 'Andamento final alcançado', category: 'Performance', position: 12, is_optional: false },
  { title: 'Peça de memória', category: 'Performance', position: 13, is_optional: true },
  { title: 'Pronta para performance', category: 'Performance', position: 14, is_optional: false },
]