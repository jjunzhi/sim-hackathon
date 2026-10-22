import { describe, expect, it } from "vitest";
import { canPublish, publishChecklist } from "./publish";

const photo = { path: "venues/v/spaces/s/a.webp", width: 2048, height: 1536, contentType: "image/webp" as const };

describe("publishChecklist", () => {
  it("blocks a venue with no spaces", () => {
    expect(canPublish(publishChecklist({ name: "Hall", address: "1 Road" }, []))).toBe(false);
  });

  it("blocks when any space lacks a photo", () => {
    expect(canPublish(publishChecklist({ name: "Hall", address: "1 Road" }, [{ photo }, { photo: null }]))).toBe(false);
  });

  it("blocks without an address", () => {
    expect(canPublish(publishChecklist({ name: "Hall", address: " " }, [{ photo }]))).toBe(false);
  });

  it("allows a complete venue", () => {
    expect(canPublish(publishChecklist({ name: "Hall", address: "1 Road" }, [{ photo }]))).toBe(true);
  });
});
