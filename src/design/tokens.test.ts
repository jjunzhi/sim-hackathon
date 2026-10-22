// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { themes } from "./tokens.mjs";

const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");

function block(name: string): Record<string, string> {
  const match = new RegExp(`/\\* tokens:${name} \\*/([\\s\\S]*?)/\\* /tokens:${name} \\*/`).exec(css);
  if (!match?.[1]) throw new Error(`tokens:${name} block not found in globals.css`);
  return Object.fromEntries([...match[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6});/g)].map((m) => [m[1], m[2]]));
}

describe("globals.css mirrors tokens.mjs", () => {
  for (const [name, palette] of Object.entries(themes)) {
    it(`${name} theme matches`, () => {
      const fromCss = block(name);
      const upper = (o: Record<string, string>) =>
        Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.toUpperCase()]));
      expect(upper(fromCss)).toEqual(upper(palette));
    });
  }
});
