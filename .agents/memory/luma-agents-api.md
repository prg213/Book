---
name: Luma Agents API
description: Correct base URL, auth, and request format for Luma video generation using platform.lumalabs.ai keys
---

## Key facts

- **User's key source**: `platform.lumalabs.ai` (new Agents platform, NOT the old Dream Machine page)
- **Env var name**: `LUMALABS_API_KEY`
- **Base URL**: `https://agents.lumalabs.ai/v1`
- **Auth header**: `Authorization: Bearer {key}` — standard Bearer, same as before
- **Submit endpoint**: `POST /generations`
- **Poll endpoint**: `GET /generations/{id}`

## Request body (image-to-video)

```json
{
  "model": "ray-3.2",
  "type": "video",
  "prompt": "...",
  "aspect_ratio": "1:1",
  "video": {
    "resolution": "540p",
    "duration": "5s",
    "start_frame": { "url": "<publicly accessible image URL>" }
  }
}
```

## Poll response

- `state`: `"queued"` → `"completed"` | `"failed"`
- `output[0].url`: presigned URL to download the MP4 (NOT `assets.video` like the old API)
- `failure_reason` / `failure_code`: error fields

## Old Dream Machine API (DO NOT USE with platform.lumalabs.ai keys)

Old base: `https://api.lumalabs.ai/dream-machine/v1`  
Old keys: from `lumalabs.ai/dream-machine/api/keys`  
Old body used `keyframes.frame0`, `loop: true` at top level — all different.

**Why:** Keys from `platform.lumalabs.ai` return 403 on the old `api.lumalabs.ai/dream-machine/v1` endpoint. The two platforms are separate.

**How to apply:** Always use `agents.lumalabs.ai/v1` when the user's key came from `platform.lumalabs.ai`.
