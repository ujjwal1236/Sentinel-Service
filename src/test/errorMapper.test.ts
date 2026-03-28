import { describe, expect, it } from "vitest";
import { mapError } from "../modules/utils/errorMapper";

describe("error mapper", () => {
  it("maps 401 to auth error", () => {
    const result = mapError({ status: 401 });
    expect(result.status).toBe("error");
    expect(result.message).toContain("Auth failure");
  });

  it("maps 404 to deprecated", () => {
    const result = mapError({ status: 404, error: { message: "model missing" } });
    expect(result.status).toBe("deprecated");
    expect(result.message).toContain("model missing");
  });

  it("maps 429 to unknown for retry later", () => {
    const result = mapError({ status: 429 });
    expect(result.status).toBe("unknown");
    expect(result.message).toContain("retry");
  });

  it("maps unknown failures to error", () => {
    const result = mapError({ message: "socket hang up" });
    expect(result.status).toBe("error");
    expect(result.message).toContain("socket hang up");
  });
});
