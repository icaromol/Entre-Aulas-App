import {
  MdSchool,
  MdTheaterComedy,
  MdPiano,
  MdMic,
  MdFiberManualRecord,
  MdAssignment,
  MdMusicNote,
  MdFolder,
  MdSync,
} from 'react-icons/md'
import type { IconType } from 'react-icons'

export interface ProgramTypeConfig {
  label: string
  Icon: IconType
  needsDeadline: boolean
}

export const PROGRAM_TYPES: Record<string, ProgramTypeConfig> = {
  regular:      { label: 'Aulas Regulares', Icon: MdSchool,          needsDeadline: false },
  recital:      { label: 'Recital',          Icon: MdTheaterComedy,   needsDeadline: true  },
  concerto:     { label: 'Concerto',         Icon: MdPiano,           needsDeadline: true  },
  show:         { label: 'Show',             Icon: MdMic,             needsDeadline: true  },
  gravacao:     { label: 'Gravação',         Icon: MdFiberManualRecord, needsDeadline: true },
  exame:        { label: 'Exame',            Icon: MdAssignment,      needsDeadline: true  },
  participacao: { label: 'Participação',     Icon: MdMusicNote,       needsDeadline: false },
  outro:        { label: 'Outro',            Icon: MdFolder,          needsDeadline: false },
}

export const MAINTENANCE_ICON = MdSync
