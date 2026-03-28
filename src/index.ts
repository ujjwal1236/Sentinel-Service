import express from "express";
import { startScheduler } from "./modules/scheduler/scheduler.service";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import modelRoutes from "./routes/model.routes";
import "dotenv/config";

const app = express();
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/", modelRoutes);

app.get("/health", (req, res) => {
  res.send("Sentinel is running 🚀");
});
startScheduler();
const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});