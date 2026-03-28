import { mapError } from "../utils/errorMapper";
import { ModelCheckResult } from "./baseAdapter";

const knownModels = ["claude-3-5-sonnet", "claude-3-haiku"];

export class AnthropicAdapter {
  constructor(private apiKey: string) {}

  async fetchModels(): Promise<string[]> {
    // Anthropic doesn't have a dedicated models.list() endpoint,
    // so we verify models by making actual API calls to each known model.
    // This ensures we're fetching updated model availability.
    
    const availableModels: string[] = [];

    for (const modelId of knownModels) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: modelId,
            max_tokens: 1,
            messages: [{ role: "user", content: "test" }],
          }),
        });

        // If request succeeds, model exists
        // We mark it as available if we got a response from the API
        if (res.status !== 401) {
          availableModels.push(modelId);
        }
      } catch (err) {
        // Network error or other issue - skip this model
        console.log(`Anthropic fetchModels: Could not verify ${modelId}:`, (err as any).message);
      }
    }

    return availableModels.length > 0 ? availableModels : knownModels;
  }

  async verifyModel(modelId: string): Promise<ModelCheckResult> {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
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
      console.log("Anthropic verifyModel error:", err);
      return mapError(err);
    }
  }
}