export interface ModelCheckResult {
  status: "active" | "deprecated" | "error" | "unknown";
  message?: string;
  sunsetDate?: string;
}

export interface ProviderAdapter {
  fetchModels(): Promise<string[]>;
  verifyModel(modelId: string): Promise<ModelCheckResult>;
}