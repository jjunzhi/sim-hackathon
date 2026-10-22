/**
 * Studio dietary filter. Only "Food and drink" items are filtered; decor is
 * never hidden. An item matches when it carries every chosen tag.
 */
export const FOOD_CATEGORY = "Food and drink";

export function matchesDiet(item: { category: string; dietaryTags?: string[] }, wanted: readonly string[]): boolean {
  if (item.category !== FOOD_CATEGORY || wanted.length === 0) return true;
  const tags = item.dietaryTags ?? [];
  return wanted.every((w) => tags.includes(w));
}
