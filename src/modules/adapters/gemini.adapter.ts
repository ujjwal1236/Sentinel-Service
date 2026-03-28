import { mapError } from "../utils/errorMapper";
import { ModelCheckResult } from "./baseAdapter";

const geminiModels = ["gemini-1.5-flash", "gemini-1.5-pro"];

export class GeminiAdapter {
  constructor(private apiKey: string) {}

  async fetchModels(): Promise<string[]> {
    return geminiModels;
  }

  async verifyModel(modelId: string): Promise<ModelCheckResult> {
    try {
      if (!geminiModels.includes(modelId)) {
        return {
          status: "deprecated",
          message: "Model not found"
        };
      }

      // minimal ping logic
      return { status: "active" };
    } catch (err: any) {
      return mapError(err);
    }
  }
}