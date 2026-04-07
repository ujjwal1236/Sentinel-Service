import { getAllModels, updateModelStatus } from "../registry/registry.service.js";
import { AlertPayload, sendAlert } from "../alerting/alert.service.js";
import { mapError } from "../utils/errorMapper.js";

import { OpenAIAdapter } from "../adapters/openai.adapter.js";
import { GeminiAdapter } from "../adapters/gemini.adapter.js";
import { AnthropicAdapter } from "../adapters/anthropic.adapter.js";
import { CohereAdapter } from "../adapters/cohere.adapter.js";
import { ENV } from "../../config/env.js";
import { ModelCheckResult, ModelStatus, ProviderAdapter } from "../adapters/baseAdapter.js";

type RegistryModel = {
  id: number;
  provider: string;
  modelId: string;
  status: ModelStatus;
  lastVerified: string | null;
  metadata: string | null;
  deprecationDate: string | null;
  sunsetDate: string | null;
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
    status: ModelStatus,
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
  return result.transient === true || result.status === "unknown";
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

export function buildDefaultAdapters(): Record<string, ProviderAdapter> {
  const adapters: Record<string, ProviderAdapter> = {};
  // In mock mode every adapter is created (OpenAI handles mock logic).
  // In real mode, only create adapters when an API key is present.
  if (ENV.USE_MOCK || ENV.OPENAI_API_KEY) adapters.openai = new OpenAIAdapter(ENV.OPENAI_API_KEY || "");
  if (ENV.USE_MOCK || ENV.ANTHROPIC_API_KEY) adapters.anthropic = new AnthropicAdapter(ENV.ANTHROPIC_API_KEY || "");
  if (ENV.USE_MOCK || ENV.COHERE_API_KEY) adapters.cohere = new CohereAdapter(ENV.COHERE_API_KEY || "");
  if (ENV.USE_MOCK || ENV.GEMINI_API_KEY) adapters.gemini = new GeminiAdapter(ENV.GEMINI_API_KEY || "");
  return adapters;
}

export async function runHealthCheck(overrides: Partial<HealthCheckDeps> = {}) {
  const deps: HealthCheckDeps = {
    getAllModels: getAllModels as () => Promise<RegistryModel[]>,
    updateModelStatus,
    sendAlert,
    ...overrides,
    adapters: overrides.adapters ?? buildDefaultAdapters()
  };

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

        await Promise.allSettled(providerModels.map(async (model) => {
          try {
          const metadata = parseMetadata(model.metadata);

          let result: ModelCheckResult;

          if (!availableModelIds.has(model.modelId)) {
            // Two-step deprecation guard: only mark deprecated when verifyModel also
            // confirms the model is gone (404 → "deprecated"). This protects against
            // partial provider responses caused by pagination limits, account-tier
            // filtering, or temporary API glitches falsely deprecating valid models.
            const crossCheck = await verifyModelWithRetry(adapter, model.modelId);
            if (crossCheck.status === "deprecated") {
              await deps.updateModelStatus(
                model.id,
                "deprecated",
                JSON.stringify(resetTransientMetadata(metadata)),
                null
              );
              console.log(
                `Model: ${model.modelId} | Provider: ${model.provider} | Status: deprecated`
              );
              if (model.status !== "deprecated") {
                await deps.sendAlert(
                  createAlertPayload(
                    "critical",
                    model,
                    "deprecated",
                    crossCheck.message || "Model deprecated"
                  )
                );
              }
              return;
            }
            // Cross-check returned a non-deprecated status — provider list may be
            // partial. Fall through to normal result processing (auth errors, transient
            // handling) using the cross-check result so the model isn't silently skipped.
            console.warn(
              `Model ${model.modelId} (${model.provider}) absent from provider list but ` +
              `verifyModel returned "${crossCheck.status}" — skipping deprecation (possible partial list)`
            );
            result = crossCheck;
          } else {
            result = await verifyModelWithRetry(adapter, model.modelId);
          }

          const status = result.status;
          const isTransient = isTransientResult(result);
          let nextMetadata: ModelMetadata;

          let shouldAlert = false;

          if (isTransient) {
            const transientFailureCount = (metadata.transientFailureCount || 0) + 1;
            shouldAlert = transientFailureCount >= 2 && !metadata.transientAlerted;
            nextMetadata = {
              ...metadata,
              transientFailureCount,
              transientAlerted: metadata.transientAlerted || shouldAlert,
              lastTransientFailureAt: new Date().toISOString(),
              lastTransientMessage: result.message
            };
          } else {
            nextMetadata = resetTransientMetadata(metadata);
          }

          // Transient failures (5xx, network, rate-limit) are stored as "unknown"
          // so the registry accurately reflects "unreachable" rather than conflating
          // temporary outages with permanent auth/config errors.
          const dbStatus = isTransient ? "unknown" : status;

          await deps.updateModelStatus(
            model.id,
            dbStatus,
            JSON.stringify(nextMetadata),
            result.sunsetDate || null
          );

          console.log(
            `Model: ${model.modelId} | Provider: ${model.provider} | Status: ${dbStatus}`
          );

          if (status === "deprecated" && model.status !== "deprecated") {
            await deps.sendAlert(
              createAlertPayload(
                "critical",
                model,
                "deprecated",
                result.message || "Model deprecated"
              )
            );
          }

          if (status === "error" && !isTransient) {
            await deps.sendAlert(
              createAlertPayload(
                "critical",
                model,
                "error",
                result.message || "API/Auth issue"
              )
            );
          }

          if (isTransient) {
            console.log(
              `Warning: Temporary issue → ${model.modelId} (${model.provider})`
            );

            if (shouldAlert) {
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
          } catch (modelErr: any) {
            console.error(`Error processing model ${model.modelId} (${provider}):`, modelErr.message);
          }
        }));
      } catch (err: any) {
        const mapped = mapError(err);
        const isTransient = mapped.transient === true;
        const dbStatus: ModelStatus = isTransient ? "unknown" : "error";

        console.error(`Health check failed for provider ${provider}:`, err.message);
        // Mark non-deprecated models; use "unknown" for transient provider outages
        // to avoid conflating temporary 5xx/network issues with permanent auth failures.
        await Promise.allSettled(
          providerModels
            .filter((model) => model.status !== "deprecated")
            .map((model) =>
              deps.updateModelStatus(model.id, dbStatus, model.metadata, null)
            )
        );
        await deps.sendAlert({
          severity: isTransient ? "warning" : "critical",
          provider,
          modelId: "(all models)",
          status: dbStatus,
          timestamp: new Date().toISOString(),
          message: err.message || "Provider health check failed — API key invalid or provider unreachable"
        });
      }
    }
  );

  // Wait for all provider checks to complete
  await Promise.all(providerCheckPromises);

  console.log("Health check completed");
}