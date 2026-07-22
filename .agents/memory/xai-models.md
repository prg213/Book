---
name: xAI model names
description: Current valid xAI API model IDs as of July 2026 — old names cause 400/404 errors
---

As of July 2026, the valid xAI API model IDs are:

**Text + Vision (multimodal):** `grok-4.5`, `grok-4.3`
- Use for chat completions (text generation and vision/image analysis)
- Replaces deprecated `grok-3` (text) and `grok-2-vision-1212` (vision)

**Image generation:** `grok-imagine-image`
- Use for `POST /v1/images/generations`
- Replaces deprecated `grok-2-image-1212`

**Why:** xAI deprecated date-suffixed model names (grok-2-vision-1212, grok-2-image-1212) and grok-3 in early 2026. The `/v1/models` endpoint confirms current available models.

**How to apply:** Any time you write xAI API calls, use these model IDs. Never use grok-3, grok-2-vision-1212, or grok-2-image-1212.
