# PurpleAI API

The Express API mounts routes under `/api`.

## Configuration

Set these secrets/environment variables in the server deployment (never in browser code):

- `HF_TOKEN`: Hugging Face token with read access to the model/endpoint.
- `PURPLEAI_MODEL_ID`: optional, defaults to `Kamiljdds/purpleaiV1.0`.
- `PURPLEAI_INFERENCE_URL`: URL of a **running inference server** that loads this custom model and accepts JSON containing `messages`, `max_tokens`, and `temperature`.

Important: the Hugging Face model repository URL is not itself an inference URL. The current custom PyTorch checkpoint needs a compatible inference server/handler. Without `PURPLEAI_INFERENCE_URL` and `HF_TOKEN`, chat intentionally returns HTTP 503 instead of pretending that generation works.

## Endpoints

- `GET /api/healthz` — API health.
- `GET /api/v1/status` — reports whether inference configuration exists.
- `GET /api/v1/models` — lists the PurpleAI model identifier.
- `POST /api/v1/chat/completions` — chat completion endpoint.

Example request:

```bash
curl -X POST "$PURPLEAI_PUBLIC_URL/api/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLIENT_API_KEY" \
  -d '{"messages":[{"role":"user","content":"Cześć!"}],"max_tokens":100,"temperature":0.7}'
```

The example shows the request body shape only. Client API-key authentication has not yet been implemented by this route; do not expose this endpoint publicly for untrusted use until authentication, per-client rate limits, and restrictive CORS are configured. The global CORS middleware is currently permissive and must be tightened before production use.

## Response format

Successful responses use the OpenAI Chat Completions response shape. If the upstream inference endpoint is missing or unavailable, the API returns a non-success HTTP status with a JSON error object.

## Model handler contract

The configured inference endpoint must load the actual checkpoint and vocab from `Kamiljdds/purpleaiV1.0` and return one of:
- OpenAI-style JSON with `choices[0].message.content`
- JSON containing `generated_text`, `response`, or `text`
- plain text

Do not configure a generic Hugging Face URL unless it actually runs this model.
