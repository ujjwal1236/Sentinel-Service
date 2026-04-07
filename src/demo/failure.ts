import { runHealthCheck } from "../modules/checker/checker.service.js";
import { ModelStatus, ProviderAdapter } from "../modules/adapters/baseAdapter.js";

type DemoModel = {
  id: number;
  provider: string;
  modelId: string;
  status: ModelStatus;
  lastVerified: string | null;
  metadata: string | null;
  deprecationDate: string | null;
  sunsetDate: string | null;
};

async function main() {
  console.log("Running demo:failure (simulated Cohere 404)...");

  const models: DemoModel[] = [
    {
      id: 1,
      provider: "cohere",
      modelId: "command-r",
      status: "active",
      lastVerified: null,
      metadata: null,
      deprecationDate: null,
      sunsetDate: null
    }
  ];

  const updates: Array<{ id: number; status: string }> = [];
  const alerts: Array<{ severity: string; status: string; provider: string; modelId: string; message: string }> = [];

  const cohereAdapter: ProviderAdapter = {
    // Simulate Cohere removing the model from their API list — the primary deprecation path.
    // verifyModel IS called as a two-step cross-check when the model is absent from fetchModels.
    // Returning "deprecated" here simulates the 404 response that confirms the model is gone.
    fetchModels: async () => [],
    verifyModel: async () => ({ status: "deprecated", message: "Model not found or deprecated" })
  };

  await runHealthCheck({
    getAllModels: async () => models,
    updateModelStatus: async (id, status) => {
      updates.push({ id, status });
      console.log(`DB_UPDATE: id=${id} status=${status}`);
    },
    sendAlert: async (payload) => {
      alerts.push({
        severity: payload.severity,
        status: payload.status,
        provider: payload.provider,
        modelId: payload.modelId,
        message: payload.message
      });
      console.log(`ALERT_FIRED: ${JSON.stringify(payload)}`);
    },
    adapters: { cohere: cohereAdapter }
  });

  const deprecatedUpdate = updates.find((update) => update.status === "deprecated");
  const deprecatedAlert = alerts.find(
    (alert) =>
      alert.provider === "cohere" &&
      alert.modelId === "command-r" &&
      alert.status === "deprecated" &&
      alert.severity === "critical"
  );

  if (!deprecatedUpdate || !deprecatedAlert) {
    console.error("Demo failed: expected deprecated update and critical alert were not produced.");
    process.exit(1);
  }

  console.log("Demo passed: Cohere 404 simulation correctly triggered critical deprecated alert.");
}

main().catch((error: any) => {
  console.error("Demo script failed:", error?.message || error);
  process.exit(1);
});
