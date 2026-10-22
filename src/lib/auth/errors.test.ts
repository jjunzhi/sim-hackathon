import { describe, expect, it } from "vitest";
import { authErrorMessage, safeNext } from "./errors";

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
    expect(authErrorMessage({ code: "auth/popup-closed-by-user" })).toBeNull();
  });

  it("does not reveal whether an email is registered on sign-in", () => {
    expect(authErrorMessage({ code: "auth/user-not-found" })).toBe(authErrorMessage({ code: "auth/wrong-password" }));
  });

  it("has a fallback", () => {
    expect(authErrorMessage(new Error("x"))).toMatch(/try again/);
  });
});
