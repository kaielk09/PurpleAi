# PurpleAI Character-Level API

This service loads the custom character-level PyTorch checkpoint from Hugging Face and exposes one OpenAI-style chat endpoint.

## Deploy

Deploy this folder as a Python/Docker web service. The Dockerfile listens on the `PORT` environment variable (default `7860`).

Set these environment variables in the hosting provider's secret/environment settings:

- `HF_TOKEN`: read token if the Hugging Face model repository is private; do not commit it.
- `PURPLEAI_MODEL_ID`: optional, defaults to `Kamiljdds/purpleaiV1.0`.
- `PURPLEAI_API_KEY`: required secret for API requests. Generate your own long random value in the hosting provider's secret manager.

The Hugging Face repository must contain `purple_ai_latest.pt` and `vocab.json`, unless you set `PURPLEAI_CHECKPOINT_FILE` or `PURPLEAI_VOCAB_FILE` to the actual filenames.

## Endpoints

- `GET /health`: public process/model health check.
- `GET /v1/models`: lists the model; requires a bearer API key.
- `POST /v1/chat/completions`: generates text; requires a bearer API key.

## Test

Replace `https://YOUR-SERVICE-URL` with the URL assigned by your hosting provider, and use your own API key in the environment variable:

```bash
curl https://YOUR-SERVICE-URL/v1/chat/completions \
  -H "Authorization: Bearer YOUR_PURPLEAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"Kamiljdds/purpleaiV1.0","messages":[{"role":"user","content":"Cześć! Napisz jedno zdanie."}],"max_tokens":80,"temperature":0.8}'
```

The response follows the usual OpenAI Chat Completions JSON shape at `choices[0].message.content`.

## Important model limitation

This is a character-level next-character model, not an instruction-tuned chat model. It may produce incoherent text and does not guarantee that it follows instructions. API compatibility only describes the request/response format, not the model's intelligence or quality.

Do not put `HF_TOKEN` or a private API key into browser JavaScript, a public repository, or a game client. Keep secrets in server-side environment variables. This service needs enough RAM to load PyTorch and the checkpoint; a host that cannot install PyTorch or has too little memory will not run it.
