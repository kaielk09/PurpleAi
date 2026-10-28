import { Router, type IRouter } from "express";

const router: IRouter = Router();

const modelId = process.env.PURPLEAI_MODEL_ID ?? "Kamiljdds/purpleaiV1.0";
const inferenceUrl = process.env.PURPLEAI_INFERENCE_URL;
const hfToken = process.env.HF_TOKEN;

router.get("/v1/models", (_req, res) => {
  res.json({
    object: "list",
    data: [{ id: modelId, object: "model", owned_by: "Kamiljdds" }],
  });
});

router.get("/v1/status", (_req, res) => {
  res.json({
    api: "ok",
    model: modelId,
    inferenceConfigured: Boolean(inferenceUrl && hfToken),
    ready: Boolean(inferenceUrl && hfToken),
    note: inferenceUrl && hfToken
      ? "Inference endpoint configured; send a test request to verify model loading."
      : "Set HF_TOKEN and PURPLEAI_INFERENCE_URL to a running inference endpoint for this model. A model repository URL alone is not an inference server.",
  });
});

router.post("/v1/chat/completions", async (req, res) => {
  const body = req.body as {
    messages?: Array<{ role?: string; content?: string }>;
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
    model?: string;
  };

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    res.status(400).json({ error: { message: "messages must be a non-empty array", type: "invalid_request_error" } });
    return;
  }
  if (body.stream) {
    res.status(400).json({ error: { message: "stream=true is not supported yet", type: "invalid_request_error" } });
    return;
  }
  const messages = body.messages.filter(m => typeof m?.content === "string" && m.content.trim());
  if (messages.length !== body.messages.length) {
    res.status(400).json({ error: { message: "Every message must contain string content", type: "invalid_request_error" } });
    return;
  }
  if (!inferenceUrl || !hfToken) {
    res.status(503).json({
      error: {
        message: "PurpleAI inference is not configured. Set HF_TOKEN and PURPLEAI_INFERENCE_URL to a running endpoint that loads Kamiljdds/purpleaiV1.0.",
        type: "model_unavailable",
        model: modelId,
      },
    });
    return;
  }

  try {
    const response = await fetch(inferenceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hfToken}`,
      },
      body: JSON.stringify({
        messages,
        max_tokens: Math.min(Math.max(Number(body.max_tokens ?? 256), 1), 2048),
        temperature: Math.min(Math.max(Number(body.temperature ?? 0.7), 0), 2),
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const raw = await response.text();
    if (!response.ok) {
      res.status(502).json({
        error: {
          message: "PurpleAI inference endpoint returned an error.",
          type: "upstream_error",
          upstream_status: response.status,
          details: raw.slice(0, 1000),
        },
      });
      return;
    }

    let result: any;
    try { result = JSON.parse(raw); } catch { result = { generated_text: raw }; }
    const answer =
      result?.choices?.[0]?.message?.content ??
      result?.generated_text ??
      result?.response ??
      result?.text;

    if (typeof answer !== "string" || !answer.trim()) {
      res.status(502).json({ error: { message: "Endpoint responded but did not return a recognized text field.", type: "invalid_model_response" } });
      return;
    }

    res.json({
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: body.model ?? modelId,
      choices: [{ index: 0, message: { role: "assistant", content: answer }, finish_reason: "stop" }],
    });
  } catch (error) {
    res.status(502).json({
      error: {
        message: error instanceof Error && error.name === "TimeoutError"
          ? "PurpleAI inference timed out."
          : "Could not reach the PurpleAI inference endpoint.",
        type: "upstream_connection_error",
      },
    });
  }
});

export default router;
