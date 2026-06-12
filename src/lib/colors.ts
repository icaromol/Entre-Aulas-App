export const COLORS = {
  softApricot: "#f4d1ae",
  yaleBlue: "#153b50",
  tomato: "#ff4c3e",
  lightGreen: "#83e07b",
  frostedBlue: "#b2f0fb",
  graphite: "#2d2b2b",
  seashell: "#fff9f3",
} as const;

export type ColorName = keyof typeof COLORS;

export const PALETTE = [
  { name: "Soft Apricot", hex: "#f4d1ae", rgb: [244, 209, 174] as const },
  { name: "Yale Blue",    hex: "#153b50", rgb: [21,  59,  80]  as const },
  { name: "Tomato",       hex: "#ff4c3e", rgb: [255, 76,  62]  as const },
  { name: "Light Green",  hex: "#83e07b", rgb: [131, 224, 123] as const },
  { name: "Frosted Blue", hex: "#b2f0fb", rgb: [178, 240, 251] as const },
  { name: "Graphite",     hex: "#2d2b2b", rgb: [45,  43,  43]  as const },
  { name: "Seashell",     hex: "#fff9f3", rgb: [255, 249, 243] as const },
] as const;
