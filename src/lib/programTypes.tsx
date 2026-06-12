import {
  MdSchool,
  MdStar,
  MdFiberManualRecord,
  MdArticle,
  MdSync,
} from 'react-icons/md'
import type { IconType } from 'react-icons'

// Triângulo sólido — não existe no MD, SVG inline
function TriangleFilled({ size = 16, color = 'currentColor', className }: { size?: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className}>
      <polygon points="12,3 22,21 2,21" />
    </svg>
  )
}

export interface ProgramTypeConfig {
  label: string
  Icon: IconType | typeof TriangleFilled
  needsDeadline: boolean
}

export const PROGRAM_TYPES: Record<string, ProgramTypeConfig> = {
  regular:      { label: 'Aulas Regulares', Icon: MdSchool,            needsDeadline: false },
  recital:      { label: 'Recital',          Icon: MdStar,              needsDeadline: true  },
  concerto:     { label: 'Concerto',         Icon: MdStar,              needsDeadline: true  },
  show:         { label: 'Show',             Icon: MdStar,              needsDeadline: true  },
  gravacao:     { label: 'Gravação',         Icon: MdFiberManualRecord, needsDeadline: true  },
  exame:        { label: 'Exame',            Icon: MdArticle,           needsDeadline: true  },
  participacao: { label: 'Participação',     Icon: MdStar,              needsDeadline: false },
  outro:        { label: 'Outro',            Icon: TriangleFilled,      needsDeadline: false },
}

export const MAINTENANCE_ICON = MdSync
