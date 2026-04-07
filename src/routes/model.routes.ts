import { Router } from "express";
import { getAllModels } from "../modules/registry/registry.service.js";
import { runHealthCheck, buildDefaultAdapters } from "../modules/checker/checker.service.js";
import { ProviderAdapter } from "../modules/adapters/baseAdapter.js";

const router = Router();

let cachedAdapters: Record<string, ProviderAdapter> | null = null;

function getAdapters(): Record<string, ProviderAdapter> {
  if (cachedAdapters) return cachedAdapters;
  cachedAdapters = buildDefaultAdapters();
  return cachedAdapters;
}

/**
 * @swagger
 * tags:
 *   - name: Models
 *   - name: Checks
 *
 * /models:
 *   get:
 *     tags: [Models]
 *     summary: Get all registry models with their statuses
 *     responses:
 *       200:
 *         description: List of models from registry
 */
router.get("/models", async (_req, res) => {
	try {
		const models = await getAllModels();
		res.status(200).json(models);
	} catch {
		res.status(500).json({ error: "Failed to fetch models" });
	}
});

/**
 * @swagger
 * /check:
 *   post:
 *     tags: [Checks]
 *     summary: Trigger full health check manually (same flow as scheduler)
 *     responses:
 *       200:
 *         description: Health check completed
 */
router.post("/check", async (_req, res) => {
	try {
		await runHealthCheck();
		res.status(200).json({ ok: true, message: "Health check completed" });
	} catch {
		res.status(500).json({ error: "Health check failed" });
	}
});

/**
 * @swagger
 * /check/{provider}/models:
 *   get:
 *     tags: [Checks]
 *     summary: Fetch live model list from a provider adapter
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [openai, anthropic, cohere, gemini]
 *     responses:
 *       200:
 *         description: Provider model list
 *       400:
 *         description: Unsupported provider
 */
router.get("/check/:provider/models", async (req, res) => {
	const provider = String(req.params.provider || "").toLowerCase();
	const adapter = getAdapters()[provider];

	if (!adapter) {
		return res.status(400).json({ error: `Unsupported provider: ${provider}` });
	}

	try {
		const models = await adapter.fetchModels();
		return res.status(200).json({ provider, models });
	} catch {
			return res
				.status(500)
				.json({ error: `Failed to fetch models for ${provider}` });
		}
});

/**
 * @swagger
 * /check/{provider}/verify:
 *   post:
 *     tags: [Checks]
 *     summary: Verify a single model against a provider adapter
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [openai, anthropic, cohere, gemini]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [modelId]
 *             properties:
 *               modelId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification result
 *       400:
 *         description: Unsupported provider or missing modelId
 */
router.post("/check/:provider/verify", async (req, res) => {
	const provider = String(req.params.provider || "").toLowerCase();
	const adapter = getAdapters()[provider];
	const modelId = String(req.body?.modelId || "").trim();

	if (!adapter) {
		return res.status(400).json({ error: `Unsupported provider: ${provider}` });
	}

	if (!modelId) {
		return res.status(400).json({ error: "modelId is required" });
	}

	try {
		const result = await adapter.verifyModel(modelId);
		return res.status(200).json({ provider, modelId, result });
	} catch {
			return res
				.status(500)
				.json({ error: `Failed to verify ${modelId}` });
		}
});

export default router;