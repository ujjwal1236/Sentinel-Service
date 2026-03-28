import { describe, expect, it, vi } from "vitest";
import { MozartSyncService, ModelInfo } from "../modules/mozart-sync/mozartSync.service";

function createMockClient() {
  return {
    post: vi.fn(),
    delete: vi.fn()
  } as any;
}

describe("MozartSyncService", () => {
  it("creates deleteModel request with expected payload", async () => {
    const client = createMockClient();
    client.delete.mockResolvedValue({ data: { ok: true } });

    const service = new MozartSyncService("https://api-dev.mozart.la", "token", client);
    const result = await service.deleteModel("cohere", "command-r");

    expect(client.delete).toHaveBeenCalledWith("/api/v1/config/deleteModel", {
      data: {
        AIProvider: "cohere",
        model: "command-r"
      }
    });

    expect(result.request).toEqual({
      AIProvider: "cohere",
      model: "command-r"
    });
  });

  it("creates createModel request with expected payload", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue({ data: { ok: true } });

    const service = new MozartSyncService("https://api-dev.mozart.la", "token", client);
    const modelData: ModelInfo = {
      modelId: "command-r-plus",
      name: "Command R Plus",
      provider: "cohere",
      description: "Cohere production model",
      contextWindow: 128000,
      maxOutputTokens: 4096,
      isPremium: true,
      isTemperatureSupported: true,
      isThinkingSupported: false,
      capabilities: ["chat", "tools"]
    };

    const result = await service.createModel("cohere", modelData);

    expect(client.post).toHaveBeenCalledWith("/api/v1/config/createModel", {
      AIProvider: "cohere",
      modelData
    });

    expect(result.request.AIProvider).toBe("cohere");
    expect(result.request.modelData.modelId).toBe("command-r-plus");
  });

  it("fetches models from Mozart config endpoint", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue({ data: { openai: ["gpt-4o"] } });

    const service = new MozartSyncService("https://api-dev.mozart.la", "token", client);
    const result = await service.getModels();

    expect(client.post).toHaveBeenCalledWith("/api/v1/config/getModels", {});
    expect(result).toEqual({ openai: ["gpt-4o"] });
  });

  it("syncs deprecated models and reports per-item success/failure", async () => {
    const client = createMockClient();
    client.delete
      .mockResolvedValueOnce({ data: { ok: true } })
      .mockRejectedValueOnce({ message: "Unauthorized" });

    const service = new MozartSyncService("https://api-dev.mozart.la", "token", client);

    const results = await service.syncDeprecatedModels([
      { provider: "cohere", modelId: "command-r" },
      { provider: "openai", modelId: "old-model" }
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
    expect(results[1].error).toContain("Unauthorized");
  });
});
