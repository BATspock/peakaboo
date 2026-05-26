// PeakAboo color tokens — Pacific Northwest field-guide vibe.
// Forest greens, glacier blues, sunrise peaks. Warm off-white background
// instead of cool slate so the app reads natural rather than corporate.

export const colors = {
  // Brand
  forest: "#1B3A2F", // primary text + dark surfaces
  forestSoft: "#2F8F62", // hero buttons, "Visible / Yes" affordance
  leaf: "#4DA070", // success accents, draft markers
  leafBg: "#E0F0E5", // subtle success backgrounds

  // Sky
  glacier: "#4A8BBF", // viewpoint markers, secondary actions
  glacierSoft: "#7AB8DC",

  // Peak (sunrise / golden hour)
  peak: "#F4A45A", // favorites star, accents
  peakSoft: "#FBE6C8", // "Today" highlight, soft alerts
  ember: "#B26023", // peak text on light bg
  emberDark: "#813F12",

  // Alert (muted clay red — natural, not Tailwind red)
  clay: "#C25450", // "Not visible / No" affordance, errors
  claySoft: "#F5DCDB",

  // Surfaces
  bg: "#F4F1E8", // main background — warm paper
  surface: "#FFFFFF", // cards, sheets
  surfaceSoft: "#EAE5D5", // muted card / chip background

  // Borders + dividers
  border: "#D4CFC0",
  borderStrong: "#B8B2A0",

  // Text
  text: "#1B2825",
  textSecondary: "#5C5F58",
  textTertiary: "#8C8F88",
  textOn: "#FFFFFF",

  // Overlays
  scrim: "rgba(15, 23, 23, 0.45)",
  scrimDeep: "rgba(0, 0, 0, 0.92)",
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;
