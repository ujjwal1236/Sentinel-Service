import { describe, expect, it } from "vitest";
import { runHealthCheck } from "../modules/checker/checker.service.js";
import { ProviderAdapter } from "../modules/adapters/baseAdapter.js";
import { TestModel } from "./helpers.js";

describe("ci guard: deprecated model alerts", () => {
  it("fails if a deprecated model was not alerted in the run", async () => {
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
      },
      {
        id: 2,
        provider: "cohere",
        modelId: "command-r-plus",
        status: "active",
        lastVerified: null,
        metadata: null,
        deprecationDate: null,
        sunsetDate: null
      }
    ];

    const updates: Array<{ id: number; status: string }> = [];
    const alerts: Array<{ provider: string; modelId: string; status: string }> = [];

    const adapter: ProviderAdapter = {
      async fetchModels() {
        return ["command-r-plus"];
      },
      async verifyModel(modelId: string) {
        // command-r is absent from the provider list; cross-check confirms it is gone
        if (modelId === "command-r") return { status: "deprecated", message: "Model not found" };
        return { status: "active" };
      }
    };

    await runHealthCheck({
      getAllModels: async () => models,
      updateModelStatus: async (id, status) => {
        updates.push({ id, status });
      },
      sendAlert: async (payload) => {
        alerts.push({
          provider: payload.provider,
          modelId: payload.modelId,
          status: payload.status
        });
      },
      adapters: { cohere: adapter }
    });

    const deprecatedIds = updates
      .filter((update) => update.status === "deprecated")
      .map((update) => update.id);

    const deprecatedModels = models.filter((model) => deprecatedIds.includes(model.id));

    for (const model of deprecatedModels) {
      const wasAlerted = alerts.some(
        (alert) =>
          alert.provider === model.provider &&
          alert.modelId === model.modelId &&
          alert.status === "deprecated"
      );
      expect(wasAlerted).toBe(true);
    }

    expect(deprecatedModels.length).toBeGreaterThan(0);
  });
});