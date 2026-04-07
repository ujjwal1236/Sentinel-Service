import axios, { AxiosInstance } from "axios";
import { ENV } from "../../config/env.js";

export type DeprecatedModelRef = {
  provider: string;
  modelId: string;
};

export type ModelInfo = {
  modelId: string;
  name: string;
  provider: string;
  description: string;
  image?: string;
  contextWindow: number;
  maxOutputTokens: number;
  isPremium: boolean;
  inputTokenCostPerMillionTokens?: number;
  outputTokenCostPerMillionTokens?: number;
  trainingData?: string;
  isTemperatureSupported: boolean;
  isThinkingSupported: boolean;
  maxTokenKey?: string;
  capabilities?: string[];
};

export class MozartSyncService {
  private readonly client: AxiosInstance;

  constructor(
    baseURL: string = ENV.MOZART_API_URL,
    token: string | undefined = ENV.MOZART_API_TOKEN,
    client?: AxiosInstance
  ) {
    this.client =
      client ||
      axios.create({
        baseURL,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        timeout: 10000
      });
  }

  async getModels() {
    const response = await this.client.post("/api/v1/config/getModels", {});
    return response.data;
  }

  async deleteModel(provider: string, modelId: string) {
    const payload = {
      AIProvider: provider,
      model: modelId
    };

    const response = await this.client.delete("/api/v1/config/deleteModel", {
      data: payload
    });

    return {
      request: payload,
      response: response.data
    };
  }

  async createModel(provider: string, modelData: ModelInfo) {
    const payload = {
      AIProvider: provider,
      modelData
    };

    const response = await this.client.post("/api/v1/config/createModel", payload);

    return {
      request: payload,
      response: response.data
    };
  }

  async updateModel(provider: string, modelId: string, modelData: Partial<ModelInfo>) {
    const payload = {
      AIProvider: provider,
      model: modelId,
      modelData
    };

    const response = await this.client.put("/api/v1/config/updateModel", payload);

    return {
      request: payload,
      response: response.data
    };
  }

  async syncDeprecatedModels(deprecatedModels: DeprecatedModelRef[]) {
    const settled = await Promise.allSettled(
      deprecatedModels.map((model) => this.deleteModel(model.provider, model.modelId))
    );

    return settled.map((outcome, i) => {
      const model = deprecatedModels[i];
      if (outcome.status === "fulfilled") {
        return {
          provider: model.provider,
          modelId: model.modelId,
          ok: true,
          request: outcome.value.request
        };
      }
      const error = outcome.reason;
      return {
        provider: model.provider,
        modelId: model.modelId,
        ok: false,
        error: error?.response?.data?.message || error?.message || "Unknown error",
        request: { AIProvider: model.provider, model: model.modelId }
      };
    });
  }
}
