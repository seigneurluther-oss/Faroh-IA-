---
name: Gemini availability
description: External Gemini API behavior observed during Faroh IA integration.
---

The Gemini API can accept a valid API key while returning model-capacity or quota errors: flash models may return HTTP 503 during high demand, while pro models may return HTTP 429 when the key has no available generation quota. A 401/403 should be treated as an authentication or API-activation problem, not conflated with provider capacity.

**Why:** Testing showed the replacement key was valid, but multiple listed generation models were unavailable because of provider demand or quota.

**How to apply:** Keep provider status details in server logs, return a user-safe retry message, and avoid asking the user to replace a key when the provider response is 503 or 429.