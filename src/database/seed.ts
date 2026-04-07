import { dbPromise } from "./db.js";
import { ensureModelsTable } from "../modules/registry/registry.service.js";

(async () => {
  await ensureModelsTable();

  const db = await dbPromise;

  const models = [
    // OpenAI
    { provider: "openai", modelId: "gpt-4o", status: "active" },
    { provider: "openai", modelId: "gpt-4o-mini", status: "active" },

    // Anthropic
    { provider: "anthropic", modelId: "claude-3-5-sonnet", status: "active" },
    { provider: "anthropic", modelId: "claude-3-haiku", status: "active" },

    // Cohere
    { provider: "cohere", modelId: "command-r", status: "active" },
    { provider: "cohere", modelId: "command-r-plus", status: "active" },

    // Gemini
    { provider: "gemini", modelId: "gemini-1.5-flash", status: "active" },
    { provider: "gemini", modelId: "gemini-1.5-pro", status: "active" }
  ];

  for (const m of models) {
    await db.run(
      `
      INSERT INTO models (provider, modelId, status, lastVerified, metadata)
      VALUES (?, ?, ?, datetime('now'), ?)
      ON CONFLICT(provider, modelId) DO NOTHING
      `,
      [
        m.provider,
        m.modelId,
        m.status,
        JSON.stringify({ seeded: true })
      ]
    );
  }

  console.log("Seed done (OpenAI + Anthropic + Cohere + Gemini)");
})();