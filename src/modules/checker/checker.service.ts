import { getAllModels, updateModelStatus } from "../registry/registry.service";
import { AlertPayload, sendAlert } from "../alerting/alert.service";

import { OpenAIAdapter } from "../adapters/openai.adapter";
import { GeminiAdapter } from "../adapters/gemini.adapter";
import { AnthropicAdapter } from "../adapters/anthropic.adapter";
import { CohereAdapter } from "../adapters/cohere.adapter";
import { ENV } from "../../config/env";
import { ProviderAdapter } from "../adapters/baseAdapter";

type RegistryModel = {
  id: number;
  provider: string;
  modelId: string;
  status: string;
  lastVerified: string | null;
  metadata: string | null;
  deprecationDate: string | null;
  sunsetDate: string | null;
};

type ModelCheckResult = {
  status: "active" | "deprecated" | "error" | "unknown";
  message?: string;
  sunsetDate?: string;
};

type ModelMetadata = {
  seeded?: boolean;
  transientFailureCount?: number;
  transientAlerted?: boolean;
  lastTransientFailureAt?: string;
  lastTransientMessage?: string;
};

const MAX_TRANSIENT_RETRIES = 2;
const BASE_BACKOFF_MS = 500;

type HealthCheckDeps = {
  getAllModels: () => Promise<RegistryModel[]>;
  updateModelStatus: (
    id: number,
    status: string,
    metadata: string | null,
    sunsetDate: string | null
  ) => Promise<void>;
  sendAlert: (payload: AlertPayload) => Promise<void>;
  adapters: Record<string, ProviderAdapter>;
};

function createAlertPayload(
  severity: AlertPayload["severity"],
  model: Pick<RegistryModel, "modelId" | "provider">,
  status: AlertPayload["status"],
  message: string
): AlertPayload {
  return {
    severity,
    modelId: model.modelId,
    provider: model.provider,
    status,
    timestamp: new Date().toISOString(),
    message
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseMetadata(metadata: string | null): ModelMetadata {
  if (!metadata) {
    return {};
  }

  try {
    return JSON.parse(metadata) as ModelMetadata;
  } catch {
    return {};
  }
}

function resetTransientMetadata(metadata: ModelMetadata): ModelMetadata {
  return {
    ...metadata,
    transientFailureCount: 0,
    transientAlerted: false,
    lastTransientFailureAt: undefined,
    lastTransientMessage: undefined
  };
}

function isTransientResult(result: ModelCheckResult) {
  if (result.status === "unknown") {
    return true;
  }

  if (result.status !== "error") {
    return false;
  }

  const message = (result.message || "").toLowerCase();
  return [
    "provider internal error",
    "network",
    "timeout",
    "timed out",
    "socket",
    "econn",
    "enotfound",
    "fetch failed",
    "temporary"
  ].some((token) => message.includes(token));
}

async function verifyModelWithRetry(adapter: ProviderAdapter, modelId: string) {
  let attempt = 0;
  let result = (await adapter.verifyModel(modelId)) as ModelCheckResult;

  while (attempt < MAX_TRANSIENT_RETRIES && isTransientResult(result)) {
    const backoffMs = BASE_BACKOFF_MS * 2 ** attempt;
    console.log(
      `Retrying ${modelId} after transient failure in ${backoffMs}ms (attempt ${attempt + 2}/${MAX_TRANSIENT_RETRIES + 1})`
    );
    await sleep(backoffMs);
    attempt += 1;
    result = (await adapter.verifyModel(modelId)) as ModelCheckResult;
  }

  return result;
}

function buildDefaultAdapters(): Record<string, ProviderAdapter> {
  return {
  openai: new OpenAIAdapter(ENV.OPENAI_API_KEY || ""),
  gemini: new GeminiAdapter(ENV.GEMINI_API_KEY || ""),
  anthropic: new AnthropicAdapter(ENV.ANTHROPIC_API_KEY || ""),
  cohere: new CohereAdapter(ENV.COHERE_API_KEY || "")
  };
}

const defaultDeps: HealthCheckDeps = {
  getAllModels: getAllModels as () => Promise<RegistryModel[]>,
  updateModelStatus,
  sendAlert,
  adapters: buildDefaultAdapters()
};

export async function runHealthCheck(overrides: Partial<HealthCheckDeps> = {}) {
  const deps: HealthCheckDeps = {
    ...defaultDeps,
    ...overrides,
    adapters: overrides.adapters || defaultDeps.adapters
  };

  console.log("hit check");
  console.log("Running health check...");

  const models = await deps.getAllModels();
  const modelsByProvider = new Map<string, RegistryModel[]>();

  for (const model of models) {
    const providerModels = modelsByProvider.get(model.provider) || [];
    providerModels.push(model);
    modelsByProvider.set(model.provider, providerModels);
  }

  // Process all providers in parallel for better concurrency
  const providerCheckPromises = Array.from(modelsByProvider.entries()).map(
    async ([provider, providerModels]) => {
      const adapter = deps.adapters[provider];

      if (!adapter) {
        console.log(`No adapter found for ${provider}`);
        return;
      }

      try {
        const availableModels = await adapter.fetchModels();
        const availableModelIds = new Set(availableModels);

        for (const model of providerModels) {
          const metadata = parseMetadata(model.metadata);

          if (!availableModelIds.has(model.modelId)) {
            await deps.updateModelStatus(
              model.id,
              "deprecated",
              JSON.stringify(resetTransientMetadata(metadata)),
              null
            );
            console.log(
              `Model: ${model.modelId} | Provider: ${model.provider} | Status: deprecated`
            );
              await deps.sendAlert(
                createAlertPayload(
                  "critical",
                  model,
                  "deprecated",
                  "Model deprecated"
                )
              );
            continue;
          }

          const result = await verifyModelWithRetry(adapter, model.modelId);
          const status = result.status;
          let nextMetadata: ModelMetadata;

          if (status === "unknown") {
            const transientFailureCount = (metadata.transientFailureCount || 0) + 1;
            nextMetadata = {
              ...metadata,
              transientFailureCount,
              transientAlerted: metadata.transientAlerted || false,
              lastTransientFailureAt: new Date().toISOString(),
              lastTransientMessage: result.message
            };
          } else {
            nextMetadata = resetTransientMetadata(metadata);
          }

          await deps.updateModelStatus(
            model.id,
            status,
            JSON.stringify(nextMetadata),
            result.sunsetDate || null
          );

          console.log(
            `Model: ${model.modelId} | Provider: ${model.provider} | Status: ${status}`
          );

          if (status === "deprecated") {
            await deps.sendAlert(
              createAlertPayload(
                "critical",
                model,
                "deprecated",
                result.message || "Model deprecated"
              )
            );
          }

          if (status === "error") {
            await deps.sendAlert(
              createAlertPayload(
                "critical",
                model,
                "error",
                result.message || "API/Auth issue"
              )
            );
          }

          if (status === "unknown") {
            console.log(
              `Warning: Temporary issue → ${model.modelId} (${model.provider})`
            );

            if (
              (nextMetadata.transientFailureCount || 0) >= 2 &&
              !nextMetadata.transientAlerted
            ) {
              nextMetadata.transientAlerted = true;
              await deps.updateModelStatus(
                model.id,
                status,
                JSON.stringify(nextMetadata),
                null
              );
              await deps.sendAlert(
                createAlertPayload(
                  "warning",
                  model,
                  "unknown",
                  "Model unreachable after 2 runs"
                )
              );
            }
          }
        }
      } catch (err: any) {
        console.error(`Health check failed for provider ${provider}:`, err.message);
      }
    }
  );

  // Wait for all provider checks to complete
  await Promise.all(providerCheckPromises);

  console.log("Health check completed");
}