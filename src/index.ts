import express from "express";
import { startScheduler } from "./modules/scheduler/scheduler.service.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.js";
import modelRoutes from "./routes/model.routes.js";
import healthRoutes from "./routes/health.routes.js";
import { ENV } from "./config/env.js";

const app = express();
app.use(express.json({ limit: "16kb" }));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/", healthRoutes);
app.use("/", modelRoutes);

startScheduler();

const server = app.listen(ENV.PORT, () => {
  console.log(`Server running on port ${ENV.PORT}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => process.exit(0));
});