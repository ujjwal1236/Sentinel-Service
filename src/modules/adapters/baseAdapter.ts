export type ModelStatus = "active" | "deprecated" | "error" | "unknown";

export interface ModelCheckResult {
  status: ModelStatus;
  message?: string;
  sunsetDate?: string;
  transient?: boolean;
}

export interface ProviderAdapter {
  fetchModels(): Promise<string[]>;
  verifyModel(modelId: string): Promise<ModelCheckResult>;
}