export interface ChecklistItemTemplate {
  title: string
  category: string
  position: number
  is_optional: boolean
}

export const DEFAULT_CHECKLIST: ChecklistItemTemplate[] = [
  { title: 'Leitura completa',                    category: 'Etapas', position: 0, is_optional: false },
  { title: 'Trabalho de passagens desafiadoras',  category: 'Etapas', position: 1, is_optional: false },
  { title: 'Execução completa',                   category: 'Etapas', position: 2, is_optional: false },
  { title: 'Expressividade e musicalidade',       category: 'Etapas', position: 3, is_optional: false },
]