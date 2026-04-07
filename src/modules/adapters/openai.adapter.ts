import OpenAI from "openai";
import { ENV } from "../../config/env.js";
import { mapError } from "../utils/errorMapper.js";
import { ModelCheckResult, ProviderAdapter } from "./baseAdapter.js";

const mockModels = ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"];

export class OpenAIAdapter implements ProviderAdapter {
  private client?: OpenAI;

  constructor(private apiKey: string) {
    if (!ENV.USE_MOCK && this.apiKey) {
      this.client = new OpenAI({ apiKey: this.apiKey, timeout: 10000 });
    }
  }

  async fetchModels(): Promise<string[]> {
    if (ENV.USE_MOCK) {
      return mockModels;
    }
    if (!this.client) {
      throw new Error("Auth failure: Missing OpenAI API key");
    }
    const res = await this.client.models.list();
    const models = res.data.map((m: any) => m.id);
    if (models.length === 0) {
      throw new Error("OpenAI returned an empty model list");
    }
    return models;
  }

  async verifyModel(modelId: string): Promise<ModelCheckResult> {
    try {
      if (ENV.USE_MOCK) {
        if (modelId === "invalid-key-test") return { status: "error", message: "Auth failure: Invalid API key" };
        if (modelId === "rate-limit-test") return { status: "unknown", message: "Rate limit simulated" };
        if (mockModels.includes(modelId)) return { status: "active" };
        return { status: "deprecated", message: "Model not found" };
      }

      if (!this.client) {
        return { status: "error", message: "Missing OpenAI API key" };
      }
      await this.client.chat.completions.create({
        model: modelId,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1
      });
      return { status: "active" };
    } catch (err: any) {
      return mapError(err);
    }
  }
}