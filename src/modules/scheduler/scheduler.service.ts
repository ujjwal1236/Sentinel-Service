import cron from "node-cron";
import { runHealthCheck } from "../checker/checker.service.js";
import { ENV } from "../../config/env.js";

export function startScheduler() {
  const intervalHours = ENV.HEALTH_CHECK_INTERVAL_HOURS;

  if (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 24) {
    throw new Error(
      `Invalid HEALTH_CHECK_INTERVAL_HOURS: ${intervalHours}. Must be an integer between 1 and 24.`
    );
  }

  // Standard 5-field cron: minute hour dom month dow
  // 0 */N * * *  → at minute 0, every N-th hour
  const cronExpression = `0 */${intervalHours} * * *`;
  
  console.log(`Scheduler started with interval: every ${intervalHours} hours`);
  console.log(`Cron expression: ${cronExpression}`);

  cron.schedule(cronExpression, () => {
    console.log(`Running scheduled health check (interval: ${intervalHours}h)...`);
    runHealthCheck().catch((err: unknown) => {
      console.error("Scheduled health check failed:", err instanceof Error ? err.message : err);
    });
  });
}