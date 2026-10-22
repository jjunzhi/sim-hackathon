/**
 * Theme choices shown to people. The prompt wording lives only on the server
 * (functions/src/render/themes.ts); a test keeps the two id lists in step.
 * Cultural theme content NEEDS COMMUNITY REVIEW before launch.
 */
export const THEME_OPTIONS = [
  { value: "peranakan", label: "Peranakan" },
  { value: "modern-botanical", label: "Modern Botanical" },
  { value: "chinese", label: "Chinese" },
  { value: "malay-pelamin", label: "Malay Pelamin" },
  { value: "indian-vivaha", label: "Indian Vivaha" },
  { value: "fusion-chinese-malay", label: "Fusion: Chinese and Malay", description: "Blends both traditions" },
  { value: "fusion-chinese-indian", label: "Fusion: Chinese and Indian", description: "Blends both traditions" },
  { value: "fusion-malay-indian", label: "Fusion: Malay and Indian", description: "Blends both traditions" },
] as const;

export type ThemeId = (typeof THEME_OPTIONS)[number]["value"];

export const themeLabel = (id: string) => THEME_OPTIONS.find((t) => t.value === id)?.label ?? id;

/** Dictionary key for each theme id ("theme.<camelCase>"); descriptions are "<key>.description". */
const THEME_KEYS: Record<ThemeId, string> = {
  peranakan: "theme.peranakan",
  "modern-botanical": "theme.modernBotanical",
  chinese: "theme.chinese",
  "malay-pelamin": "theme.malayPelamin",
  "indian-vivaha": "theme.indianVivaha",
  "fusion-chinese-malay": "theme.fusionChineseMalay",
  "fusion-chinese-indian": "theme.fusionChineseIndian",
  "fusion-malay-indian": "theme.fusionMalayIndian",
};

const isThemeId = (id: string): id is ThemeId => id in THEME_KEYS;

/** Translated theme name for components (pass `t` from useT()). Unknown ids come back unchanged. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const themeLabelT = (t: (key: any, vars?: any) => string, themeId: string): string => (isThemeId(themeId) ? t(THEME_KEYS[themeId]) : themeLabel(themeId));

/** Translated theme description, or undefined for themes without one. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const themeDescriptionT = (t: (key: any, vars?: any) => string, themeId: string): string | undefined => {
  const opt = THEME_OPTIONS.find((o) => o.value === themeId);
  return opt && "description" in opt && isThemeId(themeId) ? t(`${THEME_KEYS[themeId]}.description`) : undefined;
};
