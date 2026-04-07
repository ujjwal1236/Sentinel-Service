# Deployment

## Runtime Requirements

- Node.js 18+
- pnpm 10+
- SQLite file storage (default local mode)

## Environment Variables

Required for full provider + alert behavior:

- OPENAI_API_KEY
- ANTHROPIC_API_KEY
- COHERE_API_KEY
- SLACK_WEBHOOK_URL

Optional:

- GEMINI_API_KEY
- HEALTH_CHECK_INTERVAL_HOURS (default: 6) — interval in whole hours between health check runs
- PORT (default: 3000) — HTTP port the service listens on
- DB_PATH — absolute path to SQLite file (default: sentinel.db in project root)
- USE_MOCK (true/false, default: false) — skip real provider API calls; use mock adapters for local dev/demo
- MOZART_API_URL (default: https://api-dev.mozart.la) — base URL for Mozart config API
- MOZART_API_TOKEN — bearer token for Mozart API authentication
- ALERT_EMAIL_TO
- ALERT_EMAIL_FROM
- SMTP_HOST
- SMTP_PORT (default: 587)
- SMTP_SECURE (true or false)
- SMTP_USER
- SMTP_PASS

## Local Run

1. Install dependencies:

   pnpm install

2. Seed the model registry (run once after first install):

   pnpm seed

3. Build:

   pnpm build

4. Start:

   pnpm start

Service endpoints:

- GET /health
- GET /models
- POST /check
- Swagger UI at /api-docs

## Docker

Build image:

```bash
docker build -t sentinel-service:latest .
```

Run container:

```bash
docker run --rm -p 3000:3000 \
  -e OPENAI_API_KEY=your_openai_key \
  -e ANTHROPIC_API_KEY=your_anthropic_key \
  -e COHERE_API_KEY=your_cohere_key \
  -e SLACK_WEBHOOK_URL=your_slack_webhook \
  -e HEALTH_CHECK_INTERVAL_HOURS=6 \
  sentinel-service:latest
```

Seed the model registry (run once after the container starts, or before first use):

```bash
docker run --rm \
  -e DB_PATH=/data/sentinel.db \
  -v sentinel-data:/data \
  sentinel-service:latest node dist/database/seed.js
```

## Scheduler Configuration

The scheduler cron expression is generated from HEALTH_CHECK_INTERVAL_HOURS.

Examples:

- 6 means every 6 hours
- 1 means hourly

## Running Tests

```bash
pnpm test
```

Runs 18 unit + integration tests covering: status mapping, retry backoff, deprecation detection, alert dispatch, and Mozart sync.

## Demo Failure Script

Simulates a Cohere 404 to prove the deprecation-detection and alerting path works end-to-end without real API keys:

```bash
pnpm demo:failure
```

Expected output: `Demo passed: Cohere 404 simulation correctly triggered critical deprecated alert.`

## Release Checklist

- pnpm test passes
- pnpm build passes
- pnpm demo:failure passes
- Slack webhook tested in staging
- Required docs are included in repository root
