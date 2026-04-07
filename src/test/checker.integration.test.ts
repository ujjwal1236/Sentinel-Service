import { describe, expect, it } from "vitest";
import { runHealthCheck } from "../modules/checker/checker.service.js";
import { ProviderAdapter } from "../modules/adapters/baseAdapter.js";
import { TestModel } from "./helpers.js";

describe("integration: provider 404 alert", () => {
  it("sends a critical alert when model is absent from provider list", async () => {
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

    // fetchModels returns empty list — "command-r" is no longer in the provider's list.
    // verifyModel is called as a cross-check and confirms the model is gone (404).
    const adapter: ProviderAdapter = {
      fetchModels: async () => [],
      verifyModel: async () => ({ status: "deprecated", message: "Model not found" })
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

  it("sends a critical alert when verifyModel returns auth failure (401)", async () => {
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

    const adapter: ProviderAdapter = {
      fetchModels: async () => ["gpt-4o"],
      verifyModel: async () => ({ status: "error", message: "Auth failure: Invalid API key" })
    };

    const alerts: Array<{ severity: string; status: string }> = [];
    const updates: Array<{ id: number; status: string }> = [];

    await runHealthCheck({
      getAllModels: async () => models,
      updateModelStatus: async (id, status) => {
        updates.push({ id, status });
      },
      sendAlert: async (payload) => {
        alerts.push({ severity: payload.severity, status: payload.status });
      },
      adapters: { openai: adapter }
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ severity: "critical", status: "error" });
    expect(updates[0]?.status).toBe("error");
  });

  it("marks non-deprecated models as error and fires provider-level alert when fetchModels throws", async () => {
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
      },
      {
        id: 2,
        provider: "openai",
        modelId: "gpt-4o-mini",
        status: "deprecated",
        lastVerified: null,
        metadata: null,
        deprecationDate: "2026-01-01T00:00:00.000Z",
        sunsetDate: null
      }
    ];

    const adapter: ProviderAdapter = {
      fetchModels: async () => { throw new Error("Auth failure: Invalid API key"); },
      verifyModel: async () => ({ status: "active" })
    };

    const updates: Array<{ id: number; status: string }> = [];
    const alerts: Array<{ severity: string; modelId: string }> = [];

    await runHealthCheck({
      getAllModels: async () => models,
      updateModelStatus: async (id, status) => {
        updates.push({ id, status });
      },
      sendAlert: async (payload) => {
        alerts.push({ severity: payload.severity, modelId: payload.modelId });
      },
      adapters: { openai: adapter }
    });

    // Only the active model (id=1) should be marked error; the deprecated one (id=2) is untouched
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ id: 1, status: "error" });

    // Provider-level critical alert fires
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ severity: "critical", modelId: "(all models)" });
  });

  it("stores unknown and fires warning when fetchModels throws a transient (503) error", async () => {
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

    const adapter: ProviderAdapter = {
      fetchModels: async () => { throw { status: 503, error: { message: "Service Unavailable" } }; },
      verifyModel: async () => ({ status: "active" })
    };

    const updates: Array<{ id: number; status: string }> = [];
    const alerts: Array<{ severity: string; modelId: string; status: string }> = [];

    await runHealthCheck({
      getAllModels: async () => models,
      updateModelStatus: async (id, status) => {
        updates.push({ id, status });
      },
      sendAlert: async (payload) => {
        alerts.push({ severity: payload.severity, modelId: payload.modelId, status: payload.status });
      },
      adapters: { openai: adapter }
    });

    // Transient provider error → unknown, not error
    expect(updates[0]).toMatchObject({ id: 1, status: "unknown" });
    // Warning, not critical — it's transient
    expect(alerts[0]).toMatchObject({ severity: "warning", modelId: "(all models)", status: "unknown" });
  });
});
