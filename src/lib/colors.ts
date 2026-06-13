export const COLORS = {
  // Primárias sólidas
  tomato:       "#ff4c3e",  // Tomato — vermelho principal (design, não destrutivo)
  yale:         "#153b50",  // Yale Blue — azul escuro principal
  frosted:      "#b2f0fb",  // Frosted Blue — azul claro / destaque

  // Fundos suaves (pastéis)
  lavenderBlush: "#ffeceb", // fundo suave do tomato
  aliceBlue:     "#eff7fb", // fundo suave do azul
  azureMist:     "#ecfbfe", // fundo suave do ciano
  whiteSmoke:    "#f5f5f5", // fundo neutro de página

  // Saturados (destaques e acentos)
  pureRed:      "#f50c00",  // Pure Red — destaque extremo
  cerulean:     "#297aa3",  // Cerulean — azul médio
  pacificCyan:  "#0993ae",  // Pacific Cyan — ciano saturado

  // Neutros
  graphite:     "#292929",  // texto escuro, ícones
  white:        "#ffffff",
} as const;

export type ColorName = keyof typeof COLORS;

export const AVATAR_COLORS = [
  COLORS.yale,        // Yale Blue — obrigatório
  COLORS.tomato,      // Tomato — obrigatório
  COLORS.frosted,     // Frosted Blue — opcional
  COLORS.white,       // Branco — opcional
] as const;

export const PALETTE = [
  { name: "Tomato",          hex: "#ff4c3e", rgb: [255, 76,  62]  as const },
  { name: "Yale Blue",       hex: "#153b50", rgb: [21,  59,  80]  as const },
  { name: "Frosted Blue",    hex: "#b2f0fb", rgb: [178, 240, 251] as const },
  { name: "Lavender Blush",  hex: "#ffeceb", rgb: [255, 236, 235] as const },
  { name: "Alice Blue",      hex: "#eff7fb", rgb: [239, 247, 251] as const },
  { name: "Azure Mist",      hex: "#ecfbfe", rgb: [236, 251, 254] as const },
  { name: "White Smoke",     hex: "#f5f5f5", rgb: [245, 245, 245] as const },
  { name: "Pure Red",        hex: "#f50c00", rgb: [245, 12,  0]   as const },
  { name: "Cerulean",        hex: "#297aa3", rgb: [41,  122, 163] as const },
  { name: "Pacific Cyan",    hex: "#0993ae", rgb: [9,   147, 174] as const },
  { name: "Graphite",        hex: "#292929", rgb: [41,  41,  41]  as const },
  { name: "White",           hex: "#ffffff", rgb: [255, 255, 255] as const },
] as const;
