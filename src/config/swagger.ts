import swaggerJsdoc from "swagger-jsdoc";
import { ENV } from "./env.js";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Sentinel API",
      version: "1.0.0",
      description: "Model Monitoring & Alerting Service"
    },
    servers: [
      {
        url: `http://localhost:${ENV.PORT}`
      }
    ]
  },
  apis: ["./src/routes/*.ts"]
};

export const swaggerSpec = swaggerJsdoc(options);