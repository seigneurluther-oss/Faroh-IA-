---
name: Expo production ports
description: Port separation and startup requirements for the Faroh IA Expo artifact.
---

The Expo artifact's production server must bind the service port assigned in its artifact configuration, while the static build's Metro process needs a separate temporary port when the mockup server already occupies 8081.

**Why:** A production publish check can fail before serving any content if the server has a bad relative import or if the build's Metro process collides with the mockup service.

**How to apply:** Verify the artifact service port and production run command independently from the API port; use a separate Metro build port and test the production root plus an Expo manifest request before publishing.