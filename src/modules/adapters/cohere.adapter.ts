import { mapError } from "../utils/errorMapper";
import { ModelCheckResult } from "./baseAdapter";

export class CohereAdapter {
  constructor(private apiKey?: string) {}

  async fetchModels(): Promise<string[]> {
    if (!this.apiKey) {
      return ["command-r", "command-r-plus"];
    }

    try {
      const res = await fetch("https://api.cohere.com/v1/models", {
        method: "GET",
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

      return models.length > 0 ? models : ["command-r", "command-r-plus"];
    } catch (err: any) {
      console.log("Cohere fetchModels fallback triggered:", err?.message || err);
      return ["command-r", "command-r-plus"];
    }
  }

  async verifyModel(modelId: string): Promise<ModelCheckResult> {
    if (!this.apiKey) {
      console.log(`Cohere: No API key provided for ${modelId}`);
      return {
        status: "error",
        message: "Auth failure: Missing API key"
      };
    }

    try {
      // Real Cohere API call to verify model availability
      // Uses the chat endpoint with a minimal request to test API key validity
      const res = await fetch("https://api.cohere.com/v1/chat", {
        method: "POST",
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

      console.log(`✅ Cohere ${modelId} verified via API`);
      return { status: "active" };
    } catch (err: any) {
      console.log("Cohere verifyModel error:", err);

      if (err?.status === 404) {
        console.log(`⚠️  Cohere model ${modelId} is deprecated/removed`);
      }

      return mapError(err);
    }
  }
}