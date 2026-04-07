const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

(async () => {
  const db = await open({
    filename: './sentinel.db',
    driver: sqlite3.Database
  });

  const models = await db.all('SELECT id, provider, modelId, status, deprecationDate, sunsetDate FROM models');
  console.log('Models in DB:');
  models.forEach(m => {
    console.log(`  [${m.id}] ${m.provider}:${m.modelId} - status: ${m.status}, deprecationDate: ${m.deprecationDate}, sunsetDate: ${m.sunsetDate}`);
  });

  await db.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
