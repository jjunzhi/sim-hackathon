import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";
import { lookup } from "@/lib/i18n/format";
import { authErrorMessage, safeNext, type Translate } from "./errors";

const t: Translate = (key, vars) => lookup(en, en, "en", key, vars);

describe("safeNext", () => {
  it.each([
    ["/vendor", "/vendor"],
    ["/vendor/venues/abc?x=1", "/vendor/venues/abc?x=1"],
    ["//evil.example", null],
    ["/\\evil.example", null],
    ["https://evil.example", null],
    ["", null],
    [null, null],
  ])("%s -> %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});

describe("authErrorMessage", () => {
  it("stays silent when the person closes the Google window", () => {
    expect(authErrorMessage({ code: "auth/popup-closed-by-user" }, t)).toBeNull();
  });

  it("does not reveal whether an email is registered on sign-in", () => {
    expect(authErrorMessage({ code: "auth/user-not-found" }, t)).toBe(authErrorMessage({ code: "auth/wrong-password" }, t));
  });

  it("has a fallback", () => {
    expect(authErrorMessage(new Error("x"), t)).toMatch(/try again/);
  });
});
