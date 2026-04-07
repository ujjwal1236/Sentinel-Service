import { mapError } from "../utils/errorMapper.js";
import { ModelCheckResult, ProviderAdapter } from "./baseAdapter.js";
import { ENV } from "../../config/env.js";

const mockModels = ["claude-3-5-sonnet", "claude-3-haiku"];

export class AnthropicAdapter implements ProviderAdapter {
  constructor(private apiKey: string) {}

  async fetchModels(): Promise<string[]> {
    if (ENV.USE_MOCK) return mockModels;
    if (!this.apiKey) {
      throw new Error("Auth failure: Missing Anthropic API key");
    }
    const res = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      signal: AbortSignal.timeout(10000),
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01"
      }
    });
    if (!res.ok) {
      const error = await res.json();
      throw { status: res.status, error };
    }
    const json = await res.json();
    const ids: string[] = Array.isArray(json?.data)
      ? json.data
          .map((m: any) => (typeof m?.id === "string" ? m.id.replace(/-\d{8}$/, "") : null))
          .filter((id: string | null): id is string => id !== null)
      : [];
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      throw new Error("Anthropic returned an empty model list");
    }
    return unique;
  }

  async verifyModel(modelId: string): Promise<ModelCheckResult> {
    if (ENV.USE_MOCK) {
      return mockModels.includes(modelId)
        ? { status: "active" }
        : { status: "deprecated", message: "Model not found" };
    }
    if (!this.apiKey) {
      return { status: "error", message: "Auth failure: Missing Anthropic API key" };
    }
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
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