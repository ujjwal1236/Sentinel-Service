export type ModelStatus = "active" | "deprecated" | "error" | "unknown";

export interface ModelCheckResult {
  status: ModelStatus;
  message?: string;
  sunsetDate?: string;
}

export function mapError(err: any): ModelCheckResult {
  const statusCode =
    err?.status ||
    err?.response?.status ||
    err?.code;

  const providerMessage =
    err?.error?.message ||
    err?.error?.error?.message ||
    err?.response?.data?.message ||
    err?.message;

  // Debug ke liye helpful
  console.log("Error mapping triggered:", statusCode, err?.message);

  switch (statusCode) {
    case 401:
      return {
        status: "error",
        message: "Auth failure: Invalid API key"
      };

    case 404:
      return {
        status: "deprecated",
        message: providerMessage || "Model not found or deprecated"
      };

    case 429:
      return {
        status: "unknown",
        message: "Rate limit exceeded - retry later"
      };

    case 500:
      return {
        status: "error",
        message: "Provider internal error"
      };

    default:
      return {
        status: "error",
        message: providerMessage || "Unknown error"
      };
  }
}