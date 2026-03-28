import { describe, expect, it, vi } from "vitest";
import { runHealthCheck } from "../modules/checker/checker.service";
import { ProviderAdapter } from "../modules/adapters/baseAdapter";

type TestModel = {
  id: number;
  provider: string;
  modelId: string;
  status: string;
  lastVerified: string | null;
  metadata: string | null;
  deprecationDate: string | null;
  sunsetDate: string | null;
};

describe("checker retry behavior", () => {
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

    await runHealthCheck({
      getAllModels: async () => models,
      updateModelStatus: async (_id, status) => {
        updates.push({ status });
      },
      sendAlert: async (payload) => {
        alerts.push({ status: payload.status });
      },
      adapters: { openai: adapter }
    });

    expect(verifyModel).toHaveBeenCalledTimes(3);
    expect(updates[updates.length - 1]?.status).toBe("active");
    expect(alerts).toHaveLength(0);
  });
});
