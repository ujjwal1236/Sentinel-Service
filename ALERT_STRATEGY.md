# Alert Strategy

## Severity Rules

## Critical

Send immediately when:

- A model is deprecated or missing from provider model list.
- API authentication fails (invalid or missing API key).
- Provider returns a hard failure that maps to error and is non-transient.

Payload fields:

- severity
- modelId
- provider
- status
- timestamp
- message

## Warning

Used for transient or potentially recoverable failures:

- Rate limits
- Temporary network issues
- Provider timeout or short-lived unavailability

Handling:

1. Retry in-run with exponential backoff (up to 2 retries).
2. If failure remains unknown/transient for 2 consecutive runs, emit warning alert.
3. Reset warning counters when model health returns active.

## Escalation Guidance

Wake an engineer immediately for Critical alerts when:

- Auth failures impact any production provider key.
- Multiple deprecated models are detected in one run.
- Deprecated model is still referenced by production routing.

Log-only (no immediate wake-up) for:

- Single transient warning below threshold.
- One-off warning that self-recovers on next run.

## Channels

- Required: Slack webhook
- Optional: Email via SMTP
- If webhook is missing, alerts are logged in structured JSON for local verification.

## Noise Control

- Warning alerts are delayed until repeated failures across runs.
- Transient metadata is persisted and reset after recovery.
- Critical alerts are not delayed.
