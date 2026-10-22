import type { ThemeDefinition } from "./themes.js";

/** Bump whenever the wording changes: it is part of the cache key. */
export const PROMPT_TEMPLATE_VERSION = "v1";

export const MODEL_NAME = "gemini-nano-banana-2.1";
export const IMAGE_SIZE = "1K";

export interface PromptItem {
  name: string;
  category: string;
  unit: string;
  description: string;
}

/**
 * The first image is the real, empty room. Each following image is one
 * selected item, in the same order as the list.
 */
export function buildPrompt(theme: ThemeDefinition, items: PromptItem[]): string {
  const list = items.length
    ? items.map((i, n) => `${n + 1}. ${i.name} (${i.category}, priced ${i.unit})${i.description ? `: ${i.description}` : ""} - reference image ${n + 2}`).join("\n")
    : "(no decor items selected: show the room styled only with lighting and colour mood)";
  return [
    "Edit the first image, which is a photo of a real wedding venue room.",
    "Keep the room exactly as it is: same architecture, walls, floor, ceiling, windows, doors, built-in fixtures, camera position, lens and perspective.",
    "Decorate it for a wedding using ONLY the decor items listed below. Each item must look like its reference image. Do not add any other decor, furniture, flowers or objects that are not listed.",
    "Place items where a professional wedding stylist would, at a realistic scale for this room.",
    `Styling direction: ${theme.style}`,
    "Do not add people, text, signage words, logos or watermarks.",
    "Selected items:",
    list,
  ].join("\n");
}

const RATIOS: Array<[string, number]> = [
  ["1:1", 1],
  ["4:3", 4 / 3],
  ["3:4", 3 / 4],
  ["3:2", 3 / 2],
  ["2:3", 2 / 3],
  ["16:9", 16 / 9],
  ["9:16", 9 / 16],
  ["5:4", 5 / 4],
  ["4:5", 4 / 5],
  ["21:9", 21 / 9],
];

/** Closest supported output aspect ratio to the room photo. */
export function nearestAspectRatio(width: number, height: number): string {
  const r = width / height;
  let best = RATIOS[0]!;
  for (const cand of RATIOS) if (Math.abs(Math.log(cand[1] / r)) < Math.abs(Math.log(best[1] / r))) best = cand;
  return best[0];
}
