import { describe, expect, it } from "vitest";
import { callableCode, callableMessage } from "./callable-error";

describe("callable errors", () => {
  it("strip the SDK's status suffix and code prefix", () => {
    const err = { code: "functions/failed-precondition", message: "billing-not-configured [400]" };
    expect(callableCode(err)).toBe("failed-precondition");
    expect(callableMessage(err)).toBe("billing-not-configured");
  });

  it("leave plain messages alone", () => {
    expect(callableMessage({ message: "You've used today's renders. Try again tomorrow." })).toBe("You've used today's renders. Try again tomorrow.");
    expect(callableMessage({})).toBe("");
    expect(callableCode(new Error("x"))).toBe("");
  });
});
