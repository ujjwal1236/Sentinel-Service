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
- HEALTH_CHECK_INTERVAL_HOURS (default: 6)
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

2. Build:

   pnpm build

3. Start:

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

## Scheduler Configuration

The scheduler cron expression is generated from HEALTH_CHECK_INTERVAL_HOURS.

Examples:

- 6 means every 6 hours
- 1 means hourly

## Release Checklist

- pnpm test passes
- pnpm build passes
- pnpm demo:failure passes
- Slack webhook tested in staging
- Required docs are included in repository root
