import { mapError } from "../utils/errorMapper.js";
import { ModelCheckResult, ProviderAdapter } from "./baseAdapter.js";
import { ENV } from "../../config/env.js";

const mockModels = ["gemini-1.5-pro", "gemini-1.5-flash"];

export class GeminiAdapter implements ProviderAdapter {
  constructor(private apiKey: string) {}

  async fetchModels(): Promise<string[]> {
    if (ENV.USE_MOCK) return mockModels;
    if (!this.apiKey) {
      throw new Error("Auth failure: Missing Gemini API key");
    }
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models",
      { method: "GET", signal: AbortSignal.timeout(10000), headers: { "x-goog-api-key": this.apiKey } }
    );
    if (!res.ok) {
      const error = await res.json();
      throw { status: res.status, error };
    }
    const json = await res.json();
    const models = Array.isArray(json?.models)
      ? json.models
          .map((m: any) =>
            typeof m?.name === "string" ? m.name.replace(/^models\//, "") : null
          )
          .filter((n: string | null): n is string => n !== null)
      : [];
    if (models.length === 0) {
      throw new Error("Gemini returned an empty model list");
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
      return { status: "error", message: "Auth failure: Missing Gemini API key" };
    }
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
        {
          method: "POST",
          signal: AbortSignal.timeout(10000),
          headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "ping" }] }],
            generationConfig: { maxOutputTokens: 1 }
          })
        }
      );
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