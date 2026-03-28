import { dbPromise } from "./db";

(async () => {
  const db = await dbPromise;

  await db.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      modelId TEXT NOT NULL,
      status TEXT CHECK(status IN ('active', 'deprecated', 'error', 'unknown')) DEFAULT 'unknown',
      lastVerified DATETIME,
      metadata TEXT,
      deprecationDate DATETIME,
      sunsetDate DATETIME,
      UNIQUE(provider, modelId)
    )
  `);

  const models = [
    // OpenAI
    { provider: "openai", modelId: "gpt-4o", status: "active" },
    { provider: "openai", modelId: "gpt-4o-mini", status: "active" },

    // Anthropic
    { provider: "anthropic", modelId: "claude-3-5-sonnet", status: "active" },
    { provider: "anthropic", modelId: "claude-3-haiku", status: "active" },

    // Cohere
    { provider: "cohere", modelId: "command-r", status: "unknown" },
    { provider: "cohere", modelId: "command-r-plus", status: "unknown" },

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