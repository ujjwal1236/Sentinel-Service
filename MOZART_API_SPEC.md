# MOZART API SPEC

## Base URL

- Default: https://api-dev.mozart.la
- Configured via env: MOZART_API_URL (or SERVER_API_URL fallback)

## Auth

- Requests support Authorization: Bearer <token>
- Token source: MOZART_API_TOKEN
- Note: JWT_SECRET_KEY is not a bearer token and cannot be used directly as Authorization header value.

## Implemented Contract

## Get Models

- Method: POST
- Endpoint: /api/v1/config/getModels
- Request body: {}
- Response: models grouped by provider

Example request:

```json
{}
```

## Create Model

- Method: POST
- Endpoint: /api/v1/config/createModel
- Request body:

```json
{
  "AIProvider": "cohere",
  "modelData": {
    "modelId": "command-r-plus",
    "name": "Command R Plus",
    "provider": "cohere",
    "description": "Cohere production model",
    "contextWindow": 128000,
    "maxOutputTokens": 4096,
    "isPremium": true,
    "isTemperatureSupported": true,
    "isThinkingSupported": false,
    "capabilities": ["chat", "tools"]
  }
}
```

## Delete Model

- Method: DELETE
- Endpoint: /api/v1/config/deleteModel
- Request body:

```json
{
  "AIProvider": "cohere",
  "model": "command-r"
}
```

## Service API in this repo

Module: src/modules/mozart-sync/mozartSync.service.ts

Exports:

- getModels()
- createModel(provider, modelData)
- deleteModel(provider, modelId)
- syncDeprecatedModels([{ provider, modelId }])

## Endpoint Reachability Check (performed)

- GET https://api-dev.mozart.la returned 200
- POST /api/v1/config/getModels without auth returned 401

This confirms network access works and endpoint auth is enforced.
