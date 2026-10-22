import type { en } from "./en";

/** Every locale carries every English key. TypeScript enforces it; a unit test checks it too. */
export type Key = keyof typeof en;
export type Dictionary = Record<Key, string>;

/** Plural keys are addressed by their base name (`x`), stored as `x_one`, `x_other`, ... */
type PluralBase<K> = K extends `${infer B}_other` ? B : never;
export type TKey = Key | PluralBase<Key>;

export interface LocaleFile {
  /** "draft" until a native speaker has reviewed it; the UI says so. */
  status: "draft" | "reviewed";
  strings: Dictionary;
}
