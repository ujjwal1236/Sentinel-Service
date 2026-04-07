import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { runHealthCheck } from "../modules/checker/checker.service.js";
import { ProviderAdapter } from "../modules/adapters/baseAdapter.js";
import { TestModel } from "./helpers.js";

describe("checker retry behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries transient failures and eventually marks model active", async () => {
    const models: TestModel[] = [
      {
        id: 1,
        provider: "openai",
        modelId: "gpt-4o",
        status: "active",
        lastVerified: null,
        metadata: null,
        deprecationDate: null,
        sunsetDate: null
      }
    ];

    const verifyModel = vi
      .fn()
      .mockResolvedValueOnce({ status: "unknown", message: "timeout" })
      .mockResolvedValueOnce({ status: "unknown", message: "timeout" })
      .mockResolvedValueOnce({ status: "active" });

    const adapter: ProviderAdapter = {
      fetchModels: async () => ["gpt-4o"],
      verifyModel
    };

    const updates: Array<{ status: string }> = [];
    const alerts: Array<{ status: string }> = [];

    const healthCheckPromise = runHealthCheck({
      getAllModels: async () => models,
      updateModelStatus: async (_id, status) => {
        updates.push({ status });
      },
      sendAlert: async (payload) => {
        alerts.push({ status: payload.status });
      },
      adapters: { openai: adapter }
    });

    await vi.runAllTimersAsync();
    await healthCheckPromise;

    expect(verifyModel).toHaveBeenCalledTimes(3);
    expect(updates[updates.length - 1]?.status).toBe("active");
    expect(alerts).toHaveLength(0);
  });

  it("transient 500 is stored as unknown, no critical alert, warning fires after 2 runs", async () => {
    // First run: transient 500 — count=1, no alert yet
    const models: TestModel[] = [
      {
        id: 1,
        provider: "openai",
        modelId: "gpt-4o",
        status: "active",
        lastVerified: null,
        metadata: JSON.stringify({ transientFailureCount: 1, transientAlerted: false }),
        deprecationDate: null,
        sunsetDate: null
      }
    ];

    const verifyModel = vi.fn().mockResolvedValue({ status: "error", transient: true, message: "Provider internal error" });

    const adapter: ProviderAdapter = {
      fetchModels: async () => ["gpt-4o"],
      verifyModel
    };

    const updates: Array<{ id: number; status: string }> = [];
    const alerts: Array<{ severity: string; status: string }> = [];

    const healthCheckPromise = runHealthCheck({
      getAllModels: async () => models,
      updateModelStatus: async (id, status) => {
        updates.push({ id, status });
      },
      sendAlert: async (payload) => {
        alerts.push({ severity: payload.severity, status: payload.status });
      },
      adapters: { openai: adapter }
    });

    await vi.runAllTimersAsync();
    await healthCheckPromise;

    // Must be stored as "unknown" not "error" (transient, not permanent)
    expect(updates[updates.length - 1]?.status).toBe("unknown");
    // No critical alert — it's transient
    expect(alerts.some((a) => a.severity === "critical")).toBe(false);
    // Warning fires on second accumulated run (count was already 1, now 2)
    expect(alerts.some((a) => a.severity === "warning")).toBe(true);
  });
});
