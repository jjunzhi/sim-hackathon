import { describe, expect, it } from "vitest";
import { en } from "./en";
import ms from "./ms";
import ta from "./ta";
import zh from "./zh";

const locales = { zh, ms, ta };

describe("dictionaries", () => {
  const keys = Object.keys(en);

  it("English has no empty strings and every plural key has an _other form", () => {
    for (const [k, v] of Object.entries(en)) {
      expect(v, k).not.toBe("");
      const m = /^(.*)_(zero|one|two|few|many)$/.exec(k);
      if (m) expect(keys, `${k} needs ${m[1]}_other`).toContain(`${m[1]}_other`);
    }
  });

  for (const [code, file] of Object.entries(locales)) {
    it(`${code} has every English key, nothing extra, and keeps the placeholders`, () => {
      const theirs = Object.keys(file.strings);
      expect(theirs.filter((k) => !keys.includes(k))).toEqual([]);
      expect(keys.filter((k) => !theirs.includes(k))).toEqual([]);
      for (const k of keys) {
        const want = [...en[k as keyof typeof en].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        const got = [...file.strings[k as keyof typeof en].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        expect(got, `${code}:${k}`).toEqual(want);
        expect(file.strings[k as keyof typeof en], `${code}:${k}`).not.toBe("");
      }
    });
  }
});
