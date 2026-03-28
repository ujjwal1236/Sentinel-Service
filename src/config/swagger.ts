import swaggerJsdoc from "swagger-jsdoc";

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
        url: "http://localhost:3000"
      }
    ]
  },
  apis: ["./src/routes/*.ts"] // 👈 important
};

export const swaggerSpec = swaggerJsdoc(options);