import cron from "node-cron";
import { runHealthCheck } from "../checker/checker.service";
import { ENV } from "../../config/env";

export function startScheduler() {
  const intervalHours = ENV.HEALTH_CHECK_INTERVAL_HOURS;
  
  const cronExpression = `0 */${intervalHours} * * * *`;
  
  console.log(`Scheduler started with interval: every ${intervalHours} hours`);
  console.log(`Cron expression: ${cronExpression}`);

  cron.schedule(cronExpression, async () => {
    console.log(`Running scheduled health check (interval: ${intervalHours}h)...`);
    await runHealthCheck();
  });
}