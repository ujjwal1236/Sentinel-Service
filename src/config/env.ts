import dotenv from "dotenv";
dotenv.config();

const readEnv = (key: string) => {
  const value = process.env[key];
  return value ? value.trim() : undefined;
};

export const ENV = {
  USE_MOCK: process.env.USE_MOCK === "true",
  MOZART_API_URL: readEnv("MOZART_API_URL") || readEnv("SERVER_API_URL") || "https://api-dev.mozart.la",
  MOZART_API_TOKEN: readEnv("MOZART_API_TOKEN"),
  OPENAI_API_KEY: readEnv("OPENAI_API_KEY"),
  COHERE_API_KEY: readEnv("COHERE_API_KEY"),
  ANTHROPIC_API_KEY: readEnv("ANTHROPIC_API_KEY"),
  GEMINI_API_KEY: readEnv("GEMINI_API_KEY"),
  HEALTH_CHECK_INTERVAL_HOURS: parseInt(readEnv("HEALTH_CHECK_INTERVAL_HOURS") || "6", 10),
  SLACK_WEBHOOK_URL: readEnv("SLACK_WEBHOOK_URL"),
  ALERT_EMAIL_TO: readEnv("ALERT_EMAIL_TO"),
  ALERT_EMAIL_FROM: readEnv("ALERT_EMAIL_FROM"),
  SMTP_HOST: readEnv("SMTP_HOST"),
  SMTP_PORT: parseInt(readEnv("SMTP_PORT") || "587", 10),
  SMTP_SECURE: process.env.SMTP_SECURE === "true",
  SMTP_USER: readEnv("SMTP_USER"),
  SMTP_PASS: readEnv("SMTP_PASS")
};