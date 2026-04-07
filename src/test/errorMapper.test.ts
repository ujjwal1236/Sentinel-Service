import { describe, expect, it } from "vitest";
import { mapError } from "../modules/utils/errorMapper.js";

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

  it("maps 500 to transient error", () => {
    const result = mapError({ status: 500 });
    expect(result.status).toBe("error");
    expect(result.transient).toBe(true);
  });

  it("maps 403 to auth error", () => {
    const result = mapError({ status: 403 });
    expect(result.status).toBe("error");
    expect(result.message).toContain("Forbidden");
  });

  it("maps network code to transient error", () => {
    const result = mapError({ code: "ECONNREFUSED" });
    expect(result.status).toBe("error");
    expect(result.transient).toBe(true);
  });

  it("maps 502 to transient error", () => {
    const result = mapError({ status: 502 });
    expect(result.status).toBe("error");
    expect(result.transient).toBe(true);
  });

  it("maps 503 to transient error", () => {
    const result = mapError({ status: 503 });
    expect(result.status).toBe("error");
    expect(result.transient).toBe(true);
  });

  it("maps TimeoutError to transient error", () => {
    const result = mapError({ name: "TimeoutError" });
    expect(result.status).toBe("error");
    expect(result.transient).toBe(true);
    expect(result.message).toContain("timed out");
  });
});
