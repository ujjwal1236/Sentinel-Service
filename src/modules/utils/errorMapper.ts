import { ModelCheckResult, ModelStatus } from "../adapters/baseAdapter.js";

export type { ModelCheckResult, ModelStatus };

export function mapError(err: any): ModelCheckResult {
  // Separate HTTP status codes from Node.js network error codes (ENOTFOUND, ECONNREFUSED, etc.)
  const httpStatus: number | undefined = err?.status ?? err?.response?.status;
  const nodeCode: string | undefined = err?.code;

  const providerMessage =
    err?.error?.message ||
    err?.error?.error?.message ||
    err?.response?.data?.message ||
    err?.message;

  // Node.js network/OS-level errors — always transient
  if (nodeCode && !httpStatus) {
    return { status: "error", message: providerMessage || `Network error: ${nodeCode}`, transient: true };
  }

  // Request timeout (AbortSignal.timeout throws a DOMException named "TimeoutError")
  if (err?.name === "TimeoutError" || err?.name === "AbortError") {
    return { status: "error", message: "Request timed out", transient: true };
  }

  switch (httpStatus) {
    case 401:
      return { status: "error", message: "Auth failure: Invalid API key" };

    case 403:
      return { status: "error", message: "Auth failure: Forbidden" };

    case 404:
      return { status: "deprecated", message: providerMessage || "Model not found or deprecated" };

    case 429:
      return { status: "unknown", message: "Rate limit exceeded - retry later", transient: true };

    case 500:
    case 502:
    case 503:
    case 504:
      return { status: "error", message: "Provider temporarily unavailable", transient: true };

    default:
      return { status: "error", message: providerMessage || "Unknown error" };
  }
}