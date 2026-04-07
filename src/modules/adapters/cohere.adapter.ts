import { mapError } from "../utils/errorMapper.js";
import { ModelCheckResult, ProviderAdapter } from "./baseAdapter.js";
import { ENV } from "../../config/env.js";

const mockModels = ["command-r", "command-r-plus"];

export class CohereAdapter implements ProviderAdapter {
  constructor(private apiKey: string) {}

  async fetchModels(): Promise<string[]> {
    if (ENV.USE_MOCK) return mockModels;
    if (!this.apiKey) {
      throw new Error("Auth failure: Missing Cohere API key");
    }

    const res = await fetch("https://api.cohere.com/v1/models", {
      method: "GET",
      signal: AbortSignal.timeout(10000),
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      const error = await res.json();
      throw { status: res.status, error };
    }

    const json = await res.json();
    const models = Array.isArray(json?.models)
      ? json.models
          .map((model: any) => model?.name)
          .filter((name: unknown): name is string => typeof name === "string")
      : [];

    if (models.length === 0) {
      throw new Error("Cohere returned an empty model list");
    }

    return models;
  }

  async verifyModel(modelId: string): Promise<ModelCheckResult> {
    if (ENV.USE_MOCK) {
      return mockModels.includes(modelId)
        ? { status: "active" }
        : { status: "deprecated", message: "Model not found" };
    }
    if (!this.apiKey) {
      return {
        status: "error",
        message: "Auth failure: Missing API key"
      };
    }

    try {
      const res = await fetch("https://api.cohere.com/v1/chat", {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          message: "ping",
          max_tokens: 1,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw { status: res.status, error };
      }

      return { status: "active" };
    } catch (err: any) {
      return mapError(err);
    }
  }
}