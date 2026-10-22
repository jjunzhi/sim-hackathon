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
