/**
 * Theme descriptions used in the render prompt. NEEDS COMMUNITY REVIEW before
 * launch: wording about cultural traditions must be checked by people from
 * each community. Keep ids in step with src/lib/render/themes.ts (a test checks).
 */
export interface ThemeDefinition {
  id: string;
  label: string;
  /** Styling direction for the model: palette, mood, materials. Items still come only from the selected list. */
  style: string;
  needsCommunityReview: true;
}

const t = (id: string, label: string, style: string): ThemeDefinition => ({ id, label, style, needsCommunityReview: true });

export const THEMES: ThemeDefinition[] = [
  t("peranakan", "Peranakan", "Peranakan-inspired styling: jewel tones of turquoise, pink and jade, ornate pattern accents, warm lantern-like glow."),
  t("modern-botanical", "Modern Botanical", "Modern botanical styling: fresh greenery, soft whites and sage, natural textures, airy and light."),
  t("chinese", "Chinese", "Chinese wedding styling: celebratory red and gold palette, warm festive lighting, auspicious and elegant mood."),
  t("malay-pelamin", "Malay Pelamin", "Malay wedding styling with focus on a pelamin dais: rich gold, cream and royal colours, regal and graceful mood."),
  t("indian-vivaha", "Indian Vivaha", "Indian wedding styling: vibrant marigold, magenta and gold, layered warm lighting, joyful and grand mood."),
  t("fusion-chinese-malay", "Fusion: Chinese and Malay", "A respectful blend of Chinese and Malay wedding styling: red and gold balanced with cream and royal tones."),
  t("fusion-chinese-indian", "Fusion: Chinese and Indian", "A respectful blend of Chinese and Indian wedding styling: red and gold balanced with marigold and magenta."),
  t("fusion-malay-indian", "Fusion: Malay and Indian", "A respectful blend of Malay and Indian wedding styling: gold and cream balanced with marigold and magenta."),
];

export const themeById = (id: string) => THEMES.find((x) => x.id === id) ?? null;
