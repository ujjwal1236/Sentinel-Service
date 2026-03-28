import { describe, expect, it } from "vitest";
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

describe("integration: provider 404 alert", () => {
  it("sends a critical alert when provider returns model not found", async () => {
    const models: TestModel[] = [
      {
        id: 1,
        provider: "cohere",
        modelId: "command-r",
        status: "active",
        lastVerified: null,
        metadata: null,
        deprecationDate: null,
        sunsetDate: null
      }
    ];

    const adapter: ProviderAdapter = {
      fetchModels: async () => ["command-r"],
      verifyModel: async () => ({
        status: "deprecated",
        message: "Model not found"
      })
    };

    const alerts: Array<{ severity: string; status: string; provider: string; modelId: string }> = [];

    await runHealthCheck({
      getAllModels: async () => models,
      updateModelStatus: async () => undefined,
      sendAlert: async (payload) => {
        alerts.push({
          severity: payload.severity,
          status: payload.status,
          provider: payload.provider,
          modelId: payload.modelId
        });
      },
      adapters: { cohere: adapter }
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      severity: "critical",
      status: "deprecated",
      provider: "cohere",
      modelId: "command-r"
    });
  });
});
