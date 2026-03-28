import { dbPromise } from "../../database/db";

async function ensureModelsTable() {
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
}

export async function getAllModels() {
  await ensureModelsTable();
  const db = await dbPromise;
  return db.all("SELECT * FROM models");
}

export async function updateModelStatus(
  id: number,
  status: string,
  metadata: string | null = null,
  sunsetDate: string | null = null
) {
  await ensureModelsTable();
  const db = await dbPromise;

  if (status === "deprecated") {
    await db.run(
      `UPDATE models 
       SET status = ?, 
           lastVerified = datetime('now'),
           metadata = ?,
           deprecationDate = datetime('now'),
           sunsetDate = ?
       WHERE id = ?`,
      [status, metadata, sunsetDate, id]
    );
  } else {
    await db.run(
      `UPDATE models 
       SET status = ?, 
           lastVerified = datetime('now'),
           metadata = ?,
           deprecationDate = NULL,
           sunsetDate = NULL
       WHERE id = ?`,
      [status, metadata, id]
    );
  }
}