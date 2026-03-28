import OpenAI from "openai";
import { ENV } from "../../config/env";
import { mapError, ModelCheckResult } from "../utils/errorMapper";

// mock models
const mockModels = ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"];

// helper
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OpenAIAdapter {
  
  private client?: OpenAI;

  constructor(private apiKey: string = ENV.OPENAI_API_KEY || "") {
    if (!ENV.USE_MOCK && this.apiKey) {
      this.client = new OpenAI({ apiKey: this.apiKey });
    }
  }

  async fetchModels(): Promise<string[]> {
    if (ENV.USE_MOCK) {
      return mockModels;
    }

    try {
      const res = await this.client?.models.list();
      console.log("OpenAI Models Response:", res);
      return res?.data.map((m: any) => m.id) || [];
    } catch (err) {
      console.error("Fetch Models Error:", err);
      return [];
    }
  }

  async verifyModel(modelId: string): Promise<ModelCheckResult> {
    try {
      await sleep(300);

      // MOCK MODE
      if (ENV.USE_MOCK) {
        console.log("OpenAI MOCK");

        if (modelId === "invalid-key-test") {
          return {
            status: "error",
            message: "Auth failure: Invalid API key"
          };
        }

        if (modelId === "rate-limit-test") {
          return {
            status: "unknown",
            message: "Rate limit simulated"
          };
        }

        if (mockModels.includes(modelId)) {
          return { status: "active" };
        }

        return {
          status: "deprecated",
          message: "Model not found"
        };
      }

      // REAL MODE
      console.log("OpenAI REAL");
      console.log("Key:", this.apiKey ? "Present" : "Missing");
      console.log("Model ID:", modelId);
      if (!this.client) {
        console.log("OpenAI REAL123");
      return {
          status: "error",
          message: "Missing OpenAI API key"
        };
      }

      await this.client!.chat.completions.create({
        model: modelId,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1
      });
      console.log(`OpenAI ${modelId} is active`);

      return { status: "active" };

    } catch (err: any) {
      console.log("Verify Model Error:", err);
      return mapError(err);
    }
  }
}