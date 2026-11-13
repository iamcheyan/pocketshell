export type ThemeColorKey = "purple" | "blue" | "green" | "pink" | "amber";
export type FontSizeKey = "normal" | "large" | "huge";

export interface ThemePalette {
  name: string;
  primary: string;         // Accent text, pills, active controls (e.g. #d0bcff)
  container: string;       // Active tab pill background (e.g. #4f378b)
  onContainer: string;     // Text on active tab (e.g. #eaddff)
  activeSurface: string;   // Active row background (e.g. #2b2930)
  switchThumb: string;     // Switch on-thumb text (e.g. #381e72)
}

export const THEME_PALETTES: Record<ThemeColorKey, ThemePalette> = {
  purple: {
    name: "theme.purple",
    primary: "#d0bcff",
    container: "#4f378b",
    onContainer: "#eaddff",
    activeSurface: "#2b2930",
    switchThumb: "#381e72",
  },
  blue: {
    name: "theme.blue",
    primary: "#a8c7fa",
    container: "#004a77",
    onContainer: "#c2e7ff",
    activeSurface: "#232a36",
    switchThumb: "#003258",
  },
  green: {
    name: "theme.green",
    primary: "#a8e6cf",
    container: "#005138",
    onContainer: "#c0f1dc",
    activeSurface: "#222e28",
    switchThumb: "#003826",
  },
  pink: {
    name: "theme.pink",
    primary: "#ffd8e4",
    container: "#7d2b45",
    onContainer: "#ffd9e2",
    activeSurface: "#302327",
    switchThumb: "#49001f",
  },
  amber: {
    name: "theme.amber",
    primary: "#ffb870",
    container: "#6d3a00",
    onContainer: "#ffddb9",
    activeSurface: "#302820",
    switchThumb: "#472400",
  },
};

export const THEME_COLORS: ThemeColorKey[] = ["purple", "blue", "green", "pink", "amber"];
export const FONT_SIZES: FontSizeKey[] = ["normal", "large", "huge"];

export interface FontScaleConfig {
  rowH: number;
  labelClass: string;
  valueClass: string;
  headerClass: string;
  chipClass: string;
  switchW: number;
  switchH: number;
}

export const FONT_SCALE_CONFIGS: Record<FontSizeKey, FontScaleConfig> = {
  normal: {
    rowH: 52,
    labelClass: "text-lg",
    valueClass: "text-base font-bold",
    headerClass: "text-lg font-bold",
    chipClass: "text-base font-bold",
    switchW: 66,
    switchH: 32,
  },
  large: {
    rowH: 56,
    labelClass: "text-xl",
    valueClass: "text-lg font-bold",
    headerClass: "text-xl font-bold",
    chipClass: "text-lg font-bold",
    switchW: 72,
    switchH: 34,
  },
  huge: {
    rowH: 62,
    labelClass: "text-2xl font-bold",
    valueClass: "text-xl font-bold",
    headerClass: "text-2xl font-bold",
    chipClass: "text-xl font-bold",
    switchW: 80,
    switchH: 38,
  },
};
