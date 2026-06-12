export const COLORS = {
  // Tríade Vermelha (Red)
  redDark:   "#FF5A53",
  redMid:    "#FF7262",
  redLight:  "#FF9F8E",

  // Tríade Verde (Green)
  greenDark:  "#009E4D",
  greenMid:   "#00BF61",
  greenLight: "#00DC7D",

  // Tríade Azul (Blue)
  blueDark:  "#0099FF",
  blueMid:   "#1BB1FF",
  blueLight: "#81CBFF",

  // Neutros
  graphite: "#2d2b2b",
  seashell: "#F8F6F5",
} as const;

export type ColorName = keyof typeof COLORS;

export const AVATAR_COLORS = [
  COLORS.blueDark,
  COLORS.blueMid,
  COLORS.blueLight,
  COLORS.seashell,
  "#FFFFFF",
] as const;

export const PALETTE = [
  { name: "Red Dark",    hex: "#FF5A53", rgb: [255, 90,  83]  as const },
  { name: "Red Mid",     hex: "#FF7262", rgb: [255, 114, 98]  as const },
  { name: "Red Light",   hex: "#FF9F8E", rgb: [255, 159, 142] as const },
  { name: "Green Dark",  hex: "#009E4D", rgb: [0,   158, 77]  as const },
  { name: "Green Mid",   hex: "#00BF61", rgb: [0,   191, 97]  as const },
  { name: "Green Light", hex: "#00DC7D", rgb: [0,   220, 125] as const },
  { name: "Blue Dark",   hex: "#0099FF", rgb: [0,   153, 255] as const },
  { name: "Blue Mid",    hex: "#1BB1FF", rgb: [27,  177, 255] as const },
  { name: "Blue Light",  hex: "#81CBFF", rgb: [129, 203, 255] as const },
  { name: "Graphite",    hex: "#2d2b2b", rgb: [45,  43,  43]  as const },
  { name: "Seashell",    hex: "#F8F6F5", rgb: [255, 249, 243] as const },
] as const;
